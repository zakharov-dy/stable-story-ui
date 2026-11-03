import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHECK_IDS,
  ProcessRegistry,
  agyArgs,
  annotateDesign,
  chromeArgs,
  extractReport,
  failedResult,
  formatSummary,
  hasFailure,
  missingViewports,
  nextEnv,
  parseArgs,
  queueOrder,
  renderAgent,
  renderPrompt,
  runQueue,
  slotPlans,
  summarizeState,
  terminateGroup,
  incompleteViewports,
  type GroupOps,
  validateReport,
  UsageError,
  type Options,
  type Report,
} from './browser-test.ts';

const WEB = path.join(import.meta.dirname, '..');
const states = ['ok', 'delayed', 'empty', 'unavailable'];
const parse = (...argv: string[]) => parseArgs(argv, states);

function report(overrides: Partial<Report> = {}): Report {
  return {
    url: 'http://127.0.0.1:3100/',
    state: 'ok',
    viewports: ['1440x900', '375x812'].map((viewport) => ({ viewport, design_diffs_total: 0, checks: CHECK_IDS.map((id) => ({ id, status: 'pass', evidence: 'seen' })) })),
    design_diffs: [],
    missing_tools: [],
    notes: '',
    ...overrides,
  };
}

const block = (value: unknown) => `\`\`\`json\n${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n\`\`\``;
const envelope = (extra: Record<string, unknown>) => ({ conversation_id: 'c', status: 'SUCCESS', duration_seconds: 270, num_turns: 9, usage: { total_tokens: 265000 }, ...extra });

describe('parseArgs', () => {
  it('takes the defaults', () => {
    expect(parse('--out', '/tmp/x', '--model', 'm')).toEqual<Options>({
      out: '/tmp/x', states, viewports: ['1440x900', '375x812'], model: 'm', port: 3100, dryRun: false,
      concurrency: 4, designDir: null, designPort: 3190, headed: false,
    });
  });

  it('requires --model', () => {
    expect(() => parse('--out', '/tmp/x')).toThrow('--model <name> is required');
  });

  it('reads every option', () => {
    const options = parse('--out', 'o', '--states', 'ok,empty', '--viewports', '800x600', '--model', 'm', '--port', '3200', '--dry-run');
    expect(options).toMatchObject({ states: ['ok', 'empty'], viewports: ['800x600'], model: 'm', port: 3200, dryRun: true });
  });

  it('reads the design, concurrency and headed options', () => {
    const options = parse('--out', 'o', '--model', 'm', '--design-dir', 'some/dir', '--design-port', '3300', '--concurrency', '2', '--headed');
    expect(options).toMatchObject({ designDir: 'some/dir', designPort: 3300, concurrency: 2, headed: true });
  });

  it('accepts the limits of --concurrency', () => {
    expect(parse('--out', 'o', '--model', 'm', '--concurrency', '1').concurrency).toBe(1);
    expect(parse('--out', 'o', '--model', 'm', '--concurrency', '8').concurrency).toBe(8);
  });

  it.each([
    [[], '--out'],
    [['--out'], 'needs a value'],
    [['--out', 'o', '--bogus'], 'unknown argument'],
    [['--out', 'o', '--states', 'ok,nope'], 'unknown state "nope"'],
    [['--out', 'o', '--viewports', '1440'], 'bad viewport'],
    [['--out', 'o', '--port', 'abc'], '--port'],
    [['--out', 'o', '--port', '9223'], 'test Chrome'],
    [['--out', 'o', '--port', '9222'], 'never used'],
    [['--out', 'o', '--live', '--api-url', 'http://localhost:8080'], 'unknown argument --live'], // live runs belong to browser-smoke
    [['--out', 'o', '--api-url', 'http://x'], 'unknown argument --api-url'],
    [['--out', 'o', '--states', 'live'], 'unknown state "live"'],
    [['--out', 'o', '--states', 'ok,ok'], 'state "ok" is given twice'],
    [['--out', 'o', '--viewports', '800x600,800x600'], 'is given twice'],
    [['--out', 'o', '--concurrency', '0'], '--concurrency must be an integer from 1 to 8'],
    [['--out', 'o', '--concurrency', '9'], '--concurrency must be an integer from 1 to 8'],
    [['--out', 'o', '--concurrency', '1.5'], '--concurrency'],
    [['--out', 'o', '--concurrency', 'many'], '--concurrency'],
    [['--out', 'o', '--design-dir'], 'needs a value'],
    [['--out', 'o', '--design-port', '9222'], 'never used'],
    [['--out', 'o', '--design-port', '9224', '--concurrency', '4'], 'test Chrome port'],
    [['--out', 'o', '--design-port', '3101', '--concurrency', '4'], 'collides with a page port'],
    [['--out', 'o', '--port', '9221', '--concurrency', '4'], 'never used'],
    [['--out', 'o', '--port', '9220', '--concurrency', '4'], 'never used'],
    [['--out', 'o', '--port', '65534', '--concurrency', '4'], 'past port 65535'],
  ])('rejects %j', (argv, message) => {
    expect(() => parse(...argv, '--model', 'm')).toThrow(UsageError);
    expect(() => parse(...argv, '--model', 'm')).toThrow(message);
  });
});

describe('renderPrompt', () => {
  const values = { URL: 'http://h:1/', STATE: 'ok', VIEWPORTS: '1440x900, 375x812', DESIGN_PLAN: 'Viewport 1440x900: mockup address http://h:2/x.html', FINGERPRINT: '(hooks) => { return `${1}`; }' };

  it('replaces every placeholder, also repeated ones', () => {
    expect(renderPrompt('{URL} {STATE} {URL} {VIEWPORTS}', values)).toBe('http://h:1/ ok http://h:1/ 1440x900, 375x812');
  });

  it('fails on a placeholder without a value', () => {
    expect(() => renderPrompt('{URL} {WIDTH}', values)).toThrow('{WIDTH}');
  });

  it('renders the shipped template completely', () => {
    const rendered = renderPrompt(readFileSync(path.join(WEB, 'browser-test', 'prompt.md'), 'utf8'), values);
    expect(rendered).not.toMatch(/\{[A-Z_]+\}/);
    expect(rendered).toContain('http://h:1/');
    for (const id of CHECK_IDS) expect(rendered).toContain(`- ${id}:`);
  });

  it('carries the fingerprint function and the design plan as they are', () => {
    const rendered = renderPrompt(readFileSync(path.join(WEB, 'browser-test', 'prompt.md'), 'utf8'), values);
    expect(rendered).toContain(values.FINGERPRINT);
    expect(rendered).toContain(values.DESIGN_PLAN);
  });

  it('does the design check only: the technical checks are left to browser-smoke', () => {
    const template = readFileSync(path.join(WEB, 'browser-test', 'prompt.md'), 'utf8');
    expect(template).toContain('browser-smoke');
    const checkIds = [...template.matchAll(/^- ([a-z-]+):/gm)].map((match) => match[1]);
    expect(checkIds).toEqual(['design']);
    expect(template).toContain('wait until it has loaded and hydrated');
    for (const gone of ['console', 'network', 'http', 'overflow', 'fonts', 'page-state', 'chart-hover', 'tone-colors', 'lighthouse']) expect(template, gone).not.toContain(`- ${gone}:`);
    expect(template).not.toMatch(/"defects"|blocker|severity|list_console_messages|list_network_requests/);
    expect(template).not.toContain('{ORIGIN}');
  });
});

describe('validateReport and the schema', () => {
  const schema = JSON.parse(readFileSync(path.join(WEB, 'browser-test', 'report.schema.json'), 'utf8')) as Schema;
  type Schema = { type?: string; enum?: string[]; required?: string[]; properties?: Record<string, Schema>; items?: Schema };

  it('accepts a complete report', () => {
    expect(validateReport(report())).toEqual([]);
  });

  // Every required field and enum value of the schema file must be enforced by the validator.
  function walk(node: Schema, value: unknown, at: string[], visit: (node: Schema, at: string[]) => void): void {
    visit(node, at);
    if (node.items !== undefined && Array.isArray(value)) value.forEach((entry, index) => walk(node.items as Schema, entry, [...at, String(index)], visit));
    for (const [key, child] of Object.entries(node.properties ?? {})) {
      if (typeof value === 'object' && value !== null && key in value) walk(child, (value as Record<string, unknown>)[key], [...at, key], visit);
    }
  }
  const sample = (): Report =>
    report({
      design_diffs: [{ viewport: '1440x900', block: 'header', property: 'sec-title.fontSize', design: '28px', page: '24px', note: 'n', source: 'fingerprint' }],
    });
  const edit = (at: string[], change: (parent: Record<string, unknown>, key: string) => void): unknown => {
    const copy = JSON.parse(JSON.stringify(sample())) as unknown;
    let parent = copy as Record<string, unknown>;
    for (const key of at.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
    change(parent, at[at.length - 1] ?? '');
    return copy;
  };

  it('enforces every required field of the schema', () => {
    let checked = 0;
    walk(schema, sample(), [], (node, at) => {
      for (const field of node.required ?? []) {
        const broken = at.length === 0 ? (() => { const copy = JSON.parse(JSON.stringify(sample())) as Record<string, unknown>; delete copy[field]; return copy; })() : edit([...at, field], (parent, key) => { delete parent[key]; });
        expect(validateReport(broken), `${[...at, field].join('.')} is required`).not.toEqual([]);
        checked += 1;
      }
    });
    expect(checked).toBeGreaterThan(10);
  });

  it('enforces every enum of the schema', () => {
    const checked = new Set<string>();
    walk(schema, sample(), [], (node, at) => {
      if (node.enum === undefined) return;
      for (const allowed of node.enum) {
        // The sample carries one value per enum; set each allowed one and a foreign one.
        expect(validateReport(edit(at, (parent, key) => { parent[key] = allowed; })), `${at.join('.')}=${allowed}`).toEqual([]);
      }
      expect(validateReport(edit(at, (parent, key) => { parent[key] = 'not-in-the-enum'; })), at.join('.')).not.toEqual([]);
      checked.add(at.filter((key) => !/^\d+$/.test(key)).join('.'));
    });
    expect([...checked].sort()).toEqual(['design_diffs.source', 'viewports.checks.id', 'viewports.checks.status']);
  });

  it('knows the design check and design_diffs of the schema', () => {
    expect(CHECK_IDS).toEqual(['design']);
    expect(schema.properties?.viewports?.items?.properties?.checks?.items?.properties?.id?.enum).toEqual(['design']);
    expect(schema.required).not.toContain('defects');
    expect(schema.properties).not.toHaveProperty('defects');
    const withDiff = report({ design_diffs: [{ viewport: '375x812', block: '-', property: 'order', design: 'a,b', page: 'b,a', note: 'n', source: 'model' }] });
    expect(validateReport(withDiff)).toEqual([]);
    expect(validateReport({ ...withDiff, design_diffs: [{ ...withDiff.design_diffs[0], source: 'guess' }] })).toContain('report.design_diffs[0].source must be one of fingerprint|model');
    expect(validateReport({ ...withDiff, design_diffs: [{ ...withDiff.design_diffs[0], accepted: true }] })).toContain('report.design_diffs[0].accepted is not allowed');
    const noTotal = report();
    expect(validateReport({ ...noTotal, viewports: [{ viewport: '1440x900', checks: [] }] })).toContain('report.viewports[0].design_diffs_total is missing');
    expect(validateReport({ ...noTotal, viewports: [{ viewport: '1440x900', checks: [], design_diffs_total: -1 }] })).toContain('report.viewports[0].design_diffs_total must be an integer of 0 or more');
    expect(validateReport({ ...noTotal, viewports: [{ viewport: '1440x900', checks: [], design_diffs_total: 1.5 }] })).toContain('report.viewports[0].design_diffs_total must be an integer of 0 or more');
  });

  it('rejects unknown fields and wrong types, as the schema does', () => {
    expect(schema).toMatchObject({ additionalProperties: false });
    expect(validateReport({ ...report(), extra: 1 })).toContain('report.extra is not allowed');
    expect(validateReport({ ...report(), defects: [] })).toContain('report.defects is not allowed');
    const lighthouse = report({ viewports: report().viewports.map((entry) => ({ ...entry, checks: [{ id: 'lighthouse', status: 'skipped', evidence: 'x' }] })) });
    expect(validateReport(lighthouse)).toContain('report.viewports[0].checks[0].id must be one of design');
    expect(validateReport({ ...report(), missing_tools: [1] })).toContain('report.missing_tools[0] must be a string');
    expect(validateReport(null)).toEqual(['report must be an object']);
  });
});

describe('extractReport', () => {
  it('takes structured_output first', () => {
    const result = extractReport(envelope({ structured_output: report({ notes: 'structured' }), response: block(report({ notes: 'text' })) }));
    expect(result).toMatchObject({ source: 'structured_output', report: { notes: 'structured' } });
  });

  it('takes the last valid block of a response that repeats the report', () => {
    const response = ['Here:', block(report({ notes: 'a' })), 'again', block(report({ notes: 'b' })), block(report({ notes: 'c' })), block(report({ notes: 'd' }))].join('\n');
    expect(extractReport(envelope({ response }))).toMatchObject({ source: 'response', report: { notes: 'd' } });
  });

  it('skips a last block that is broken and uses the valid one before it', () => {
    const response = `${block(report({ notes: 'good' }))}\n${block('{ not json')}`;
    expect(extractReport(envelope({ response }))).toMatchObject({ report: { notes: 'good' } });
  });

  it('falls back to the response when structured_output has the wrong shape', () => {
    const result = extractReport(envelope({ structured_output: { nope: 1 }, response: block(report()) }));
    expect(result).toMatchObject({ source: 'response' });
  });

  it('judges the last parseable block: a valid report followed by a malformed one is an error', () => {
    const response = `${block(report({ notes: 'good' }))}\n${block({ url: 'bad-shape' })}`;
    const result = extractReport(envelope({ response }));
    expect(result).toHaveProperty('error');
    expect(JSON.stringify(result)).toContain('wrong shape');
  });

  it('reports broken JSON', () => {
    const result = extractReport(envelope({ response: block('{ "url": ') }));
    expect(result).toHaveProperty('error');
    expect(JSON.stringify(result)).toContain('does not parse');
  });

  it('reports a response without a block', () => {
    expect(extractReport(envelope({ response: 'All good, no problems.' }))).toHaveProperty('error');
    expect(extractReport(envelope({}))).toHaveProperty('error');
  });

  it('rejects the trial-run shape: objects where arrays belong, no viewport', () => {
    const wrong = { url: 'u', state: 'ok', checks: { console: 'pass' }, defects: { console: 'x' }, missing_tools: [], notes: '' };
    const result = extractReport(envelope({ response: block(wrong) }));
    expect(result).toHaveProperty('error');
    expect(JSON.stringify(result)).toContain('wrong shape');
  });

  it('rejects a non-object output', () => {
    expect(extractReport(null)).toEqual({ error: 'the agy output is not a JSON object' });
    expect(extractReport([])).toHaveProperty('error');
  });
});

describe('summaries', () => {
  const viewports = ['1440x900', '375x812'];

  it('carries tokens, duration and missing tools', () => {
    const result = summarizeState('ok', envelope({ structured_output: report({ missing_tools: ['take_snapshot'] }) }), null, viewports);
    expect(result).toEqual({ state: 'ok', agyStatus: 'SUCCESS', missingTools: ['take_snapshot'], totalTokens: 265000, durationSeconds: 270, parseError: null, designDiffs: 0, designAccepted: 0, designRejected: 0, slot: null });
    expect(hasFailure([result])).toBe(false);
  });

  describe('design differences', () => {
    const diff = (overrides: Record<string, string> = {}) => ({ viewport: '1440x900', block: 'header', property: 'sec-title.fontSize', design: '28px', page: '24px', note: 'n', source: 'fingerprint' as const, ...overrides });
    const withDiffs = (diffs: ReturnType<typeof diff>[], totals: [number, number] = [0, 0]) =>
      report({ design_diffs: diffs, viewports: report().viewports.map((entry, index) => ({ ...entry, design_diffs_total: totals[index] ?? 0 })) });

    it('counts the differences per state and keeps them out of the exit code', () => {
      const noisy = withDiffs([diff(), diff({ property: 'root.gap' }), diff({ viewport: '375x812', block: 'feed' })], [2, 1]);
      const result = summarizeState('ok', envelope({ structured_output: noisy }), null, viewports);
      expect(result).toMatchObject({ designDiffs: 3, designAccepted: 0, parseError: null });
      expect(hasFailure([result])).toBe(false);
      expect(formatSummary([result])).toContain('design diffs 3');
      expect(formatSummary([result]).endsWith('RESULT: ok')).toBe(true);
    });

    it('counts a difference cut off by the limit through design_diffs_total', () => {
      const cut = withDiffs([diff()], [57, 0]);
      expect(summarizeState('ok', envelope({ structured_output: cut }), null, viewports).designDiffs).toBe(57);
    });

    it('never counts fewer than it lists', () => {
      const odd = withDiffs([diff(), diff({ property: 'root.gap' })], [0, 0]);
      expect(summarizeState('ok', envelope({ structured_output: odd }), null, viewports).designDiffs).toBe(2);
    });

    it('moves accepted differences out of the count and marks them in the report', () => {
      const accepted = [{ block: 'header', property: 'root.gap', reason: 'r' }, { state: 'delayed', block: 'header', property: 'sec-title.fontSize', reason: 'r' }];
      const noisy = withDiffs([diff(), diff({ property: 'root.gap' })], [2, 0]);
      const annotated = annotateDesign(noisy, 'ok', accepted);
      expect(annotated).toMatchObject({ designDiffs: 1, designAccepted: 1 });
      expect(annotated.report.design_diffs.map((entry) => entry.accepted)).toEqual([false, true]);
      expect(summarizeState('ok', envelope({ structured_output: noisy }), null, viewports, accepted)).toMatchObject({ designDiffs: 1, designAccepted: 1 });
    });

    const designCheck = (annotated: ReturnType<typeof annotateDesign>, index = 0) => annotated.report.viewports[index]?.checks.find((check) => check.id === 'design');
    const withDesign = (base: Report, status: string, evidence = 'model says so'): Report => ({
      ...base,
      viewports: base.viewports.map((entry) => ({ ...entry, checks: entry.checks.map((check) => (check.id === 'design' ? { ...check, status, evidence } : check)) })),
    });
    const accepts = [{ block: 'header', property: 'sec-title.fontSize', reason: 'r' }, { block: 'header', property: 'root.gap', reason: 'r' }];

    describe('the status after acceptance', () => {
      it('is pass with "N differences, all accepted" when every difference is accepted', () => {
        const all = withDesign(withDiffs([diff(), diff({ property: 'root.gap' })], [2, 0]), 'fail');
        const annotated = annotateDesign(all, 'ok', accepts);
        expect(designCheck(annotated)).toEqual({ id: 'design', status: 'pass', evidence: '2 differences, all accepted' });
        expect(annotated).toMatchObject({ designDiffs: 0, designAccepted: 2 });
        const result = summarizeState('ok', envelope({ structured_output: all }), null, viewports, accepts);
        expect(formatSummary([result])).toContain('design diffs 0 (+2 accepted)');
        expect(hasFailure([result])).toBe(false);
      });

      it('stays fail, naming the rest, when some differences are not accepted', () => {
        const some = withDesign(withDiffs([diff(), diff({ property: 'root.gap' }), diff({ property: 'root.color', design: 'a', page: 'b' })], [3, 0]), 'fail', '3 diffs');
        const annotated = annotateDesign(some, 'ok', accepts);
        expect(designCheck(annotated)).toEqual({ id: 'design', status: 'fail', evidence: '3 diffs (1 not accepted)' });
        expect(annotated.designDiffs).toBe(1);
      });

      it('stays fail when the list was cut off, even if every listed difference is accepted', () => {
        const cut = withDesign(withDiffs([diff()], [57, 0]), 'fail', '57 diffs');
        expect(designCheck(annotateDesign(cut, 'ok', accepts))).toMatchObject({ status: 'fail', evidence: '57 diffs (56 not accepted)' });
      });

      it('leaves a skipped check, a viewport without differences and a pass alone', () => {
        const skipped = withDesign(withDiffs([], [0, 0]), 'skipped', 'no mockup');
        expect(designCheck(annotateDesign(skipped, 'ok', accepts))).toEqual({ id: 'design', status: 'skipped', evidence: 'no mockup' });
        const clean = withDesign(withDiffs([], [0, 0]), 'pass', '0 diffs');
        expect(designCheck(annotateDesign(clean, 'ok', accepts))).toEqual({ id: 'design', status: 'pass', evidence: '0 diffs' });
      });

      it('turns a model pass into fail while a difference is not accepted, listed or not', () => {
        const listed = annotateDesign(withDesign(withDiffs([diff({ property: 'root.color', design: 'a', page: 'b' })], [1, 0]), 'pass', 'model pass'), 'ok', []);
        expect(designCheck(listed)).toEqual({ id: 'design', status: 'fail', evidence: '1 differences, 1 not accepted' });
        expect(listed.designDiffs).toBe(1);
        const unlisted = annotateDesign(withDesign(withDiffs([], [3, 0]), 'pass', 'model pass'), 'ok', []);
        expect(designCheck(unlisted)).toMatchObject({ status: 'fail', evidence: '3 differences, 3 not accepted' });
      });

      it('is decided per viewport', () => {
        const mixed = withDesign(withDiffs([diff(), diff({ viewport: '375x812', property: 'root.color', design: 'a', page: 'b' })], [1, 1]), 'fail', 'x');
        const annotated = annotateDesign(mixed, 'ok', accepts);
        expect(designCheck(annotated, 0)?.status).toBe('pass');
        expect(designCheck(annotated, 1)).toMatchObject({ status: 'fail', evidence: 'x' });
      });
    });

    describe('the guard against hand-altered fingerprint data', () => {
      const altered = () => diff({ block: 'header', property: 'root.padding', design: '12px 20px 20px', page: '12px 20px 12px 20px' });

      it('skips the viewport, moves its fingerprint items aside and counts them', () => {
        const bad = withDesign(withDiffs([altered(), diff(), diff({ viewport: '375x812' })], [2, 1]), 'fail');
        const annotated = annotateDesign(bad, 'ok', []);
        expect(designCheck(annotated, 0)).toEqual({ id: 'design', status: 'skipped', evidence: expect.stringContaining('fingerprint data altered: 1 item(s) rejected (first: header root.padding design value "12px 20px 20px" has 3 parts') as string });
        expect(annotated.report.viewports[0]?.design_diffs_total).toBe(0);
        expect(annotated.report.design_diffs.map((entry) => entry.viewport)).toEqual(['375x812']);
        expect(annotated.report.rejected_design_diffs.map((entry) => [entry.property, entry.problem === null])).toEqual([['root.padding', false], ['sec-title.fontSize', true]]);
        expect(annotated).toMatchObject({ designRejected: 1, designDiffs: 1 });
        expect(designCheck(annotated, 1)?.status).toBe('fail');
      });

      it('keeps model differences of the altered viewport and never guards them', () => {
        const model = diff({ source: 'model', property: 'order', design: 'a', page: 'b' });
        const annotated = annotateDesign(withDiffs([altered(), model], [2, 0]), 'ok', []);
        expect(annotated.report.design_diffs).toHaveLength(1);
        expect(annotated.report.viewports[0]?.design_diffs_total).toBe(1);
        expect(annotateDesign(withDiffs([diff({ source: 'model', property: 'padding', design: '1px', page: '2px' })], [1, 0]), 'ok', [])).toMatchObject({ designRejected: 0 });
      });

      it('shows in the summary and the table, and never in the exit code', () => {
        const bad = withDiffs([altered()], [1, 0]);
        const result = summarizeState('ok', envelope({ structured_output: bad }), null, viewports);
        expect(result.designRejected).toBe(1);
        expect(formatSummary([result])).toContain('(1 altered, rejected)');
        expect(hasFailure([result])).toBe(false);
      });

      it('does not touch an honest report with 4-part values', () => {
        const honest = withDiffs([diff({ property: 'root.padding', design: '12px 20px 12px 20px', page: '1px 1px 1px 1px' })], [1, 0]);
        const annotated = annotateDesign(honest, 'ok', []);
        expect(annotated.designRejected).toBe(0);
        expect(annotated.report.rejected_design_diffs).toEqual([]);
        expect(annotated.report.design_diffs).toHaveLength(1);
      });
    });

    it('a failed design check or a report full of differences still exits zero', () => {
      const failing = report({ design_diffs: [diff()], viewports: report().viewports.map((entry) => ({ ...entry, design_diffs_total: 1, checks: entry.checks.map((check) => (check.id === 'design' ? { ...check, status: 'fail' } : check)) })) });
      expect(hasFailure([summarizeState('ok', envelope({ structured_output: failing }), null, viewports)])).toBe(false);
    });

    it('a report without the design check is incomplete', () => {
      const without = report({ viewports: report().viewports.map((entry) => ({ ...entry, checks: entry.checks.filter((check) => check.id !== 'design') })) });
      expect(incompleteViewports(without, viewports)).toContain('viewport 1440x900: check design is missing');
    });

    it('failedResult is a failure with no counts', () => {
      const failed = failedResult('ok', 'START_ERROR', 'boom', 2);
      expect(failed).toMatchObject({ slot: 2, designDiffs: 0, parseError: 'boom' });
      expect(hasFailure([failed])).toBe(true);
    });
  });

  it('fails on a report that still carries defects or a technical check, as a wrong shape', () => {
    const withDefects = { ...report(), defects: [{ severity: 'blocker', viewport: '375x812', check: 'console', what: 'hydration', where: 'x' }] };
    const result = summarizeState('ok', envelope({ structured_output: withDefects }), null, viewports);
    expect(result.parseError).toContain('defects is not allowed');
    expect(hasFailure([result])).toBe(true);
    const technical = report({ viewports: report().viewports.map((entry) => ({ ...entry, checks: [...entry.checks, { id: 'console', status: 'fail', evidence: 'x' }] })) });
    expect(hasFailure([summarizeState('ok', envelope({ structured_output: technical }), null, viewports)])).toBe(true);
  });

  it('fails on a report that does not parse, never counts it as a success', () => {
    const result = summarizeState('ok', envelope({ response: 'no report' }), null, viewports);
    expect(result.parseError).not.toBeNull();
    expect(hasFailure([result])).toBe(true);
  });

  it('fails when agy did not succeed, even with a good report', () => {
    expect(hasFailure([summarizeState('ok', envelope({ status: 'ERROR', structured_output: report() }), null, viewports)])).toBe(true);
    expect(hasFailure([summarizeState('ok', envelope({ structured_output: report() }), 'TIMEOUT', viewports)])).toBe(true);
  });

  it('fails without an envelope', () => {
    const result = summarizeState('ok', null, 'EXIT_1', viewports);
    expect(result).toMatchObject({ agyStatus: 'EXIT_1', parseError: 'agy produced no JSON envelope' });
    expect(hasFailure([result])).toBe(true);
  });

  it('fails when a requested viewport is missing from the report', () => {
    const partial = report({ viewports: report().viewports.slice(0, 1) });
    expect(missingViewports(partial, viewports)).toEqual(['375x812']);
    expect(summarizeState('ok', envelope({ structured_output: partial }), null, viewports).parseError).toContain('375x812');
  });

  it('fails when a requested viewport lacks the design check, or has it twice', () => {
    const noChecks = report({ viewports: viewports.map((viewport) => ({ viewport, design_diffs_total: 0, checks: [] })) });
    const result = summarizeState('ok', envelope({ structured_output: noChecks }), null, viewports);
    expect(result.parseError).toContain('check design is missing');
    expect(hasFailure([result])).toBe(true);
    const first = report().viewports[0];
    const duplicated = report({ viewports: [{ viewport: '1440x900', design_diffs_total: 0, checks: [...(first?.checks ?? []), { id: 'design', status: 'pass', evidence: 'again' }] }, ...report().viewports.slice(1)] });
    expect(incompleteViewports(duplicated, viewports)).toEqual(['viewport 1440x900: check design appears 2 times']);
    expect(incompleteViewports(report(), viewports)).toEqual([]);
  });

  it('accepts a viewport written with the multiplication sign', () => {
    const odd = report({ viewports: report().viewports.map((entry) => ({ ...entry, viewport: entry.viewport.replace('x', '×') })) });
    expect(missingViewports(odd, viewports)).toEqual([]);
  });

  it('prints one line per state and the result', () => {
    const ok = summarizeState('ok', envelope({ structured_output: report() }), null, viewports);
    const bad = summarizeState('empty', envelope({ response: 'x' }), null, viewports);
    const text = formatSummary([ok, bad]);
    expect(text).toContain('ok');
    expect(text).toContain('parse error');
    expect(text.endsWith('RESULT: failed')).toBe(true);
    expect(formatSummary([ok]).endsWith('RESULT: ok')).toBe(true);
  });
});

describe('commands', () => {
  const options = parse('--out', 'o', '--model', 'm');

  it('starts the page per mock state, with no inherited page configuration', () => {
    process.env.MOCK_STATE = 'gap';
    process.env.API_MODE = 'live';
    process.env.API_URL = 'http://elsewhere';
    expect(nextEnv('delayed')).toMatchObject({ API_MODE: 'mock', MOCK_STATE: 'delayed' });
    expect(nextEnv('delayed').API_URL).toBeUndefined();
    delete process.env.MOCK_STATE;
    delete process.env.API_MODE;
    delete process.env.API_URL;
  });

  it('runs agy with the dedicated agent and the schema', () => {
    const args = agyArgs(options, 'the prompt');
    expect(args).toEqual(expect.arrayContaining(['--agent', 'browser-tester', '--dangerously-skip-permissions', '--output-format', 'json', '--json-schema']));
    expect(args[args.indexOf('-p') + 1]).toBe('the prompt');
    expect(args[args.indexOf('--json-schema') + 1]).toBe(path.join(WEB, 'browser-test', 'report.schema.json'));
  });

  it('runs agy with the agent of the slot', () => {
    expect(agyArgs(options, 'p', 'browser-tester-slot2')).toEqual(expect.arrayContaining(['--agent', 'browser-tester-slot2']));
  });

  it('starts the headless Chrome of a slot with its own port and test profile only', () => {
    const [slot0, slot1] = slotPlans({ port: 3100, concurrency: 2, states }, '/home/u');
    if (slot0 === undefined || slot1 === undefined) throw new Error('two slots expected');
    expect(chromeArgs(slot0, false)).toEqual(['--headless=new', '--remote-debugging-port=9223', '--user-data-dir=/home/u/.chrome-test', '--no-first-run', '--no-default-browser-check', 'about:blank']);
    expect(chromeArgs(slot1, false)).toContain('--remote-debugging-port=9224');
    expect(chromeArgs(slot1, false)).toContain('--user-data-dir=/home/u/.chrome-test-2');
  });

  it('shows a window only with --headed', () => {
    const [slot0] = slotPlans({ port: 3100, concurrency: 1, states }, '/h');
    if (slot0 === undefined) throw new Error('one slot expected');
    expect(chromeArgs(slot0, true).some((arg) => arg.startsWith('--headless'))).toBe(false);
    expect(chromeArgs(slot0, false)).toContain('--headless=new');
  });

  it('refuses the port of the other Chrome', () => {
    expect(() => chromeArgs({ chromePort: 9222, profile: '/p' }, false)).toThrow('never used');
  });

  it('never mentions the other Chrome profile; its port appears only as the rejected value', () => {
    const files = ['scripts/browser-test.ts', 'scripts/browser-test-design.ts', 'browser-test/fingerprint.js', 'browser-test/design-accepted.json', '.agents/agents/browser-tester.md', 'browser-test/prompt.md', 'browser-test/README.md'];
    for (const file of files) {
      const source = readFileSync(path.join(WEB, file), 'utf8');
      expect(source, file).not.toContain('.chrome-agent');
      if (file !== 'scripts/browser-test.ts') expect(source, file).not.toContain('9222');
    }
  });
});

describe('terminateGroup', () => {
  // A fake process table: members of the group by pid; signals act per the given behavior.
  function fake(options: { survivesTerm: boolean; survivesKill?: boolean }) {
    let members = 2; // the leader is already gone, two descendants remain
    let clock = 0;
    const signals: (string | number)[] = [];
    const ops: GroupOps = {
      kill(pid, signal) {
        expect(pid).toBe(-4242); // always the group, never a single process
        if (members === 0) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
        signals.push(signal);
        if (signal === 'SIGTERM' && !options.survivesTerm) members = 0;
        if (signal === 'SIGKILL' && !(options.survivesKill ?? false)) members = 0;
      },
      sleep: (ms) => { clock += ms; return Promise.resolve(); },
      now: () => clock,
    };
    return { ops, signals };
  }

  it('does nothing when the group is gone', async () => {
    const { ops, signals } = fake({ survivesTerm: false });
    await terminateGroup(4242, ops);
    await terminateGroup(4242, ops);
    expect(signals.filter((signal) => signal !== 0)).toEqual(['SIGTERM']);
  });

  it('terminates descendants whose leader has already exited', async () => {
    const { ops, signals } = fake({ survivesTerm: false });
    expect(await terminateGroup(4242, ops)).toBe(true);
    expect(signals).toEqual([0, 'SIGTERM']);
  });

  it('escalates to SIGKILL when a descendant ignores SIGTERM', async () => {
    const { ops, signals } = fake({ survivesTerm: true });
    expect(await terminateGroup(4242, ops)).toBe(true);
    expect(signals).toContain('SIGKILL');
    expect(signals.indexOf('SIGKILL')).toBeGreaterThan(signals.indexOf('SIGTERM'));
  });

  it('reports a group that survives SIGKILL', async () => {
    const { ops } = fake({ survivesTerm: true, survivesKill: true });
    expect(await terminateGroup(4242, ops)).toBe(false);
  });
});

describe('slots', () => {
  it('gives each slot its own page port, Chrome port, profile and agent', () => {
    const plans = slotPlans({ port: 3100, concurrency: 4, states: ['a', 'b', 'c', 'd', 'e'] }, '/h');
    expect(plans).toEqual([
      { slot: 0, webPort: 3100, chromePort: 9223, profile: '/h/.chrome-test', agent: 'browser-tester' },
      { slot: 1, webPort: 3101, chromePort: 9224, profile: '/h/.chrome-test-2', agent: 'browser-tester-slot1' },
      { slot: 2, webPort: 3102, chromePort: 9225, profile: '/h/.chrome-test-3', agent: 'browser-tester-slot2' },
      { slot: 3, webPort: 3103, chromePort: 9226, profile: '/h/.chrome-test-4', agent: 'browser-tester-slot3' },
    ]);
  });

  it('never has more slots than states, and never uses the port of the other Chrome', () => {
    expect(slotPlans({ port: 3100, concurrency: 8, states: ['a', 'b'] })).toHaveLength(2);
    const eight = slotPlans({ port: 3100, concurrency: 8, states: Array.from({ length: 8 }, (_, index) => String(index)) });
    expect(eight.map((plan) => plan.chromePort)).toEqual([9223, 9224, 9225, 9226, 9227, 9228, 9229, 9230]);
    expect(eight.map((plan) => plan.chromePort)).not.toContain(9222);
  });

  it('puts the long states first and the short ones last in the queue', () => {
    expect(queueOrder(['ok', 'empty', 'delayed', 'unavailable', 'gap'])).toEqual(['ok', 'delayed', 'gap', 'empty', 'unavailable']);
  });

  it('lets a freed slot take the next state', async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const run = (slot: number, state: string) =>
      new Promise<string>((resolve) => {
        started.push(`${slot}:${state}`);
        releases.set(state, () => resolve(`${slot}:${state}`));
      });
    const done = runQueue(['ok', 'delayed', 'gap', 'empty'], 2, run);
    await Promise.resolve();
    expect(started).toEqual(['0:ok', '1:delayed']);
    releases.get('delayed')?.(); // slot 1 is free first: it takes the next state, not slot 0
    await new Promise((resolve) => setImmediate(resolve));
    expect(started).toEqual(['0:ok', '1:delayed', '1:gap']);
    releases.get('gap')?.();
    await new Promise((resolve) => setImmediate(resolve));
    expect(started).toEqual(['0:ok', '1:delayed', '1:gap', '1:empty']);
    releases.get('ok')?.();
    releases.get('empty')?.();
    expect(await done).toEqual(['0:ok', '1:delayed', '1:gap', '1:empty']);
  });

  it('keeps the result of each occurrence of a repeated state', async () => {
    const results = await runQueue(['ok', 'ok'], 2, (slot) => Promise.resolve(slot === 0 ? 'blocker' : 'pass'));
    expect(results).toEqual(['blocker', 'pass']);
  });

  it('skips slots that cannot be used and leaves untaken states undefined', async () => {
    const seen: number[] = [];
    const results = await runQueue(['a', 'b', 'c'], 2, (slot, state) => {
      seen.push(slot);
      return Promise.resolve(state);
    }, (slot) => slot === 1);
    expect(new Set(seen)).toEqual(new Set([1]));
    expect(results).toEqual(['a', 'b', 'c']);
    expect(await runQueue(['a'], 1, (_slot, state) => Promise.resolve(state), () => false)).toEqual([undefined]);
  });
});

describe('the agent of a slot', () => {
  const template = readFileSync(path.join(WEB, '.agents', 'agents', 'browser-tester.md'), 'utf8');

  it('pins chrome-devtools-mcp and names the Chrome port once', () => {
    expect(template).toContain('chrome-devtools-mcp@1.11.0');
    expect(template).not.toContain('@latest');
    expect(template.split('--browser-url=http://127.0.0.1:9223').length).toBe(2);
    expect(template).not.toContain('9222');
  });

  it('keeps the isolation: no inherited MCP or customizations, one MCP server, tools not restricted away', () => {
    expect(template).toMatch(/^inheritMcp: false$/m);
    expect(template).toMatch(/^inheritCustomizations: false$/m);
    expect(template.match(/^ {2}- name: /gm)).toHaveLength(1);
    expect(template).toContain('- finish');
  });

  it('gives a slot its own port and name, and nothing else changes', () => {
    const rendered = renderAgent(template, { agent: 'browser-tester-slot2', chromePort: 9225 });
    expect(rendered).toContain('name: browser-tester-slot2');
    expect(rendered).toContain('--browser-url=http://127.0.0.1:9225');
    expect(rendered).not.toContain('9223');
    expect(rendered).not.toContain('9222');
    expect(rendered.match(/^ {2}- name: /gm)).toHaveLength(1);
    expect(rendered.replace('browser-tester-slot2', 'browser-tester').replaceAll('9225', '9223')).toBe(template);
  });

  it('leaves slot 0 as the template', () => {
    expect(renderAgent(template, { agent: 'browser-tester', chromePort: 9223 })).toBe(template);
  });

  it('refuses a template that does not name the port exactly once', () => {
    expect(() => renderAgent('name: browser-tester\n', { agent: 'x', chromePort: 9224 })).toThrow('exactly once');
    expect(() => renderAgent('--browser-url=http://127.0.0.1:9223 --browser-url=http://127.0.0.1:9223', { agent: 'x', chromePort: 9224 })).toThrow('exactly once');
  });
});

describe('ProcessRegistry', () => {
  it('stops what was registered, last first, once', async () => {
    const registry = new ProcessRegistry();
    const order: string[] = [];
    registry.add(() => Promise.resolve(void order.push('first')));
    registry.add(() => Promise.resolve(void order.push('second')));
    await Promise.all([registry.shutdown(), registry.shutdown()]);
    await registry.shutdown();
    expect(order).toEqual(['second', 'first']);
  });

  it('keeps going when a task fails', async () => {
    const registry = new ProcessRegistry();
    const order: string[] = [];
    registry.add(() => Promise.resolve(void order.push('kept')));
    registry.add(() => Promise.reject(new Error('boom')));
    await registry.shutdown();
    expect(order).toEqual(['kept']);
  });

  // The orphaned next-server of 2026-10-19: a state that began to start while SIGTERM was being
  // handled registered its stop after the cleanup had taken its list, and nobody ran it.
  it('stops a process that is registered while the shutdown is running, and refuses new ones', async () => {
    const registry = new ProcessRegistry();
    const stopped: string[] = [];
    let release: () => void = () => undefined;
    registry.add(() => new Promise<void>((resolve) => { release = resolve; }));
    const closing = registry.shutdown(); // blocked in the first task
    expect(registry.shuttingDown).toBe(true);
    expect(() => registry.assertOpen()).toThrow('shutting down');
    expect(() => registry.add(() => Promise.resolve(void stopped.push('late')))).toThrow('shutting down');
    release();
    await closing;
    expect(stopped).toEqual(['late']);
  });

  it('accepts registrations before the shutdown', () => {
    const registry = new ProcessRegistry();
    expect(() => registry.assertOpen()).not.toThrow();
    expect(registry.shuttingDown).toBe(false);
  });
});
