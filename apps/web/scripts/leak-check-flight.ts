// A deliberately narrow, non-executing reader of the inline Next Flight model stream.
// Framework framing changes must fail the gate, rather than drop part of the response.
export type Model = null | boolean | number | string | Model[] | { [key: string]: Model };
export type Context = { exempt: boolean; heading: string; period: string; scope: string };
export const ROOT: Context = { exempt: false, heading: '', period: '', scope: '' };

export function object(value: Model | undefined): { [key: string]: Model } | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}

export function resolveFlight(rows: Map<string, Model>, value: Model): Model {
  const resolving = new Set<string>();
  const resolve = (item: Model): Model => {
    if (typeof item !== 'string') return item;
    const match = /^\$(?:L|@)?([0-9a-f]+)((?::[^:]+)*)$/.exec(item);
    if (!match) return item;
    if (resolving.has(item)) throw new Error(`circular Flight reference ${item}`);
    resolving.add(item);
    if (!rows.has(match[1])) throw new Error(`unresolved Flight reference ${item}`);
    let result: Model = rows.get(match[1]) as Model;
    for (const part of match[2].split(':').slice(1)) {
      result = resolve(result);
      const next: Model | undefined = Array.isArray(result)
        ? result[part === 'props' ? 3 : Number(part)]
        : object(result)?.[part];
      if (next === undefined) throw new Error(`unresolved Flight path ${item}`);
      result = next;
    }
    result = resolve(result);
    resolving.delete(item);
    return result;
  };
  return resolve(value);
}

export function flightModels(html: string): Map<string, Model> {
  const chunks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].flatMap((script) =>
    [...(script[1] ?? '').matchAll(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g)]
      .map((match) => JSON.parse(match[1]) as string));
  if (chunks.length === 0) throw new Error('missing inline Flight/RSC payload');
  const rows = new Map<string, Model>();
  for (const line of chunks.join('').split('\n').filter(Boolean)) {
    // Hints have no model id. I rows describe imports, not page data.
    if (/^:H[A-Z]/.test(line)) continue;
    const row = /^([0-9a-f]+):(.*)$/.exec(line);
    if (!row) throw new Error('unknown Flight row framing');
    const [, id, body] = row;
    if (body.startsWith('I')) { rows.set(id, null); continue; }
    try { rows.set(id, JSON.parse(body) as Model); }
    catch { throw new Error(`unsupported Flight model row ${id}`); }
  }
  if (!rows.has('0')) throw new Error('missing Flight root model');
  return rows;
}

/** Follow shared references once per semantic context. An exempt reference never exempts a
 * second use elsewhere. Orphan models are checked too, so hidden/unreferenced props cannot hide. */
export function walkFlight(rows: Map<string, Model>, visit: (value: Model, context: Context) => void): void {
  const seen = new Set<string>();
  const reached = new Set<string>();
  const walk = (value: Model, context: Context): void => {
    if (typeof value === 'string') {
      const ref = /^\$(?:L|@)?([0-9a-f]+)(?::[^:]+)*$/.exec(value);
      if (ref) {
        const id = ref[1];
        if (!rows.has(id)) throw new Error(`unresolved Flight reference ${value}`);
        if (!value.includes(':')) reached.add(id);
        const key = `${value}:${JSON.stringify(context)}`;
        if (seen.has(key)) return;
        seen.add(key);
        walk(resolveFlight(rows, value), context);
        return;
      }
    }
    const props = object(value);
    if (props) {
      context = {
        exempt: context.exempt || props['data-block'] === 'records' || props['data-block'] === 'feed',
        heading: typeof props['aria-labelledby'] === 'string' ? props['aria-labelledby'] : context.heading,
        period: typeof props['data-period'] === 'string' ? props['data-period'] : context.period,
        scope: typeof props['data-scope'] === 'string' ? props['data-scope'] : context.scope,
      };
    }
    visit(value, context);
    if (Array.isArray(value)) value.forEach((child) => walk(child, context));
    else if (props) Object.values(props).forEach((child) => walk(child, context));
  };
  reached.add('0');
  walk(rows.get('0')!, ROOT);
  for (const [id, value] of rows) if (!reached.has(id)) walk(value, ROOT);
}
