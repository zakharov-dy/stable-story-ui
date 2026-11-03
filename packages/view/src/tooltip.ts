// Content of the supply-by-chain tooltip (block 03), built once on the server: rows in stack order,
// one-decimal shares taken from the share series (never recomputed from the levels), an exact bigint
// total and the quality line of the hovered column.
import { createFormat, groupDigits, parseDecimal, roundParts } from './format.ts';
import type { ViewLabels } from './labels.ts';
import { createSeries, lineValues } from './series.ts';
import type { ChainStatus, Series } from '@app/contracts';
import { scale, unscale } from './chart/scale.ts';
import type { TooltipColumn, TooltipNote, TooltipRow } from './chart/tooltip.ts';
import { chainInfo, type Chains } from './chains.ts';
import { isPartialBucket } from './resolution.ts';

/** The joined quality line; a title wording that names a chain differently is kept only when it differs. */
export function noteOf(notes: readonly TooltipNote[]): TooltipNote | undefined {
  if (notes.length === 0) return undefined;
  const text = notes.map((note) => note.text).join(' · ');
  const title = notes.map((note) => note.title ?? note.text).join(' · ');
  return { text, ...(title === text ? {} : { title }), tone: toneOf(notes) };
}

/** The most severe tone of several notes: an unreconciled day wins over a delayed chain and a gap. */
function toneOf(notes: readonly TooltipNote[]): TooltipNote['tone'] {
  if (notes.some((note) => note.tone === 'unreconciled')) return 'unreconciled';
  if (notes.some((note) => note.tone === 'delayed')) return 'delayed';
  return 'incomplete';
}

/**
 * The card's content as one sentence: the day, the total, the rows in stack order, the quality line
 * and the footer. It is the live-region announcement, so it says exactly what the visible card says.
 */
export function tooltipText(column: TooltipColumn): string {
  return tooltipSentence(column, column.note?.text);
}

/**
 * The no-JS SVG title of a column, the same sentence with the note's title wording: its rows already
 * name every chain, so a delayed note drops the name (docs/design.md).
 */
export function tooltipTitle(column: TooltipColumn): string {
  return tooltipSentence(column, column.note === undefined ? undefined : (column.note.title ?? column.note.text));
}

function tooltipSentence(column: TooltipColumn, note: string | undefined): string {
  const withShare = (text: string, share: string | undefined): string => (share === undefined ? text : `${text} (${share})`);
  const head = column.header.value === undefined ? column.header.label : `${column.header.label} ${column.header.value}`;
  const parts = [
    ...(column.hideHeader === true ? [] : [withShare(head, column.header.share)]),
    ...column.rows.map((row) => withShare(`${row.label} ${row.value}`, row.share)),
  ];
  if (note !== undefined) parts.push(note);
  parts.push(column.footer.value);
  return `${column.footer.label}: ${parts.join(' · ')}`;
}

/** Bind client-owned labels without global configuration. */
export function createTooltip(texts: ViewLabels) {
  const { formatCompact, formatCount } = createFormat(texts);
  const { bucketLabel, axisSigned } = createSeries(texts);

  /** A share with one fixed decimal: 80 → 80.0%. Null is no share (the cell stays empty). */
  function formatShare(value: string | null): string | undefined {
    if (value === null) return undefined;
    const parts = roundParts(parseDecimal(value), 1);
    const body = `${groupDigits(parts.int)}.${parts.frac}`;
    const negative = parts.negative && /[1-9]/.test(parts.int + parts.frac);
    return `${negative ? texts.minus : ''}${body}${texts.percent}`;
  }

  /**
   * One column per level bucket. The stack order is the chain order; a row's share is looked up by
   * chain key and by the bucket with the same start and end, never by row position. A column with any
   * unknown level has no total (null is not 0): the header reads "no data" and drops its share, while
   * the known rows keep their values. The delayed-chain note belongs to the newest bucket only: the
   * status describes the chart's last day, not a historical closed one.
   */
  function supplyTooltips(level: Series, share: Series, readyTotal: Series, chains: Chains, status: readonly ChainStatus[]): TooltipColumn[] {
    const lines = [...level.lines].sort((a, b) => chainInfo(chains, a.key).index - chainInfo(chains, b.key).index);
    const lists = lines.map(lineValues);
    // The card names a delayed chain (the row above does not tie the note to one); the native title
    // does not, because its rows already name every chain (docs/design.md, "A chain that is behind is
    // named once, where the chain is not already named").
    const delayed = status
      .filter((state) => state.state === 'delayed' && state.lagHours !== null)
      .map((state) => ({
        text: texts.tags.behind(chainInfo(chains, state.chain).name, formatCount(state.lagHours)),
        title: texts.tags.behindShort(formatCount(state.lagHours)),
      }));
    const newest = level.buckets.length - 1;
    return level.buckets.map((bucket, index) => {
      const values = lists.map((list) => list[index] ?? null);
      const total = readyTotal.lines[0]?.values[index] ?? null;
      const shareIndex = share.buckets.findIndex((candidate) => candidate.start === bucket.start && candidate.end === bucket.end);
      const rows: TooltipRow[] = lines.map((line, layer) => {
        const info = chainInfo(chains, line.key);
        const raw = shareIndex === -1 ? null : (share.lines.find((candidate) => candidate.key === line.key)?.values[shareIndex] ?? null);
        return {
          label: info.name,
          value: formatCompact(lists[layer]?.[index] ?? null),
          share: formatShare(raw === null ? null : String(raw)),
          chain: info.index,
        };
      });
      const notes: TooltipNote[] = [];
      if (lines.some((line) => line.unreconciled.includes(index))) {
        notes.push({ text: (level.period === 'day' ? texts.tags.unreconciledDay : texts.resolution.flagged), tone: 'unreconciled' });
      }
      if (values.some((value) => value === null)) {
        notes.push({ text: texts.supplyByChain.gapNote(bucketLabel(bucket)), tone: 'incomplete' });
      }
      if (isPartialBucket(bucket, level.period)) notes.push({ text: texts.resolution.partial, tone: 'incomplete' });
      if (index === newest && delayed.length > 0) {
        notes.push({ text: delayed.map((note) => note.text).join(' · '), title: delayed.map((note) => note.title).join(' · '), tone: 'delayed' });
      }
      return {
        header: {
          label: texts.header.cards.supply,
          value: total === null ? texts.noData : formatCompact(String(total)),
          share: total !== null && total !== '0' ? texts.supplyByChain.shareTotal : undefined,
        },
        rows,
        note: noteOf(notes),
        footer: { label: bucketLabel(bucket), value: level.period === 'day' ? texts.supplyByChain.endOfDay : texts.resolution.levelEnd(texts.resolution.units[level.period] ?? level.period) },
      };
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Drivers (block 04)

  /**
   * One column per bucket: the scope is in the footer, and rows are mint, burn,
   * bridge in, bridge out and then the net after a
   * hairline. Burn and bridge-out are stored as non-negative magnitudes and negated before
   * formatting, so they print with − like the day equation does. A day where a flow is unknown
   * keeps the column with "no data" rows (null is never 0); the quality line names the gap or the
   * unreconciled day. `digits` is the chart's own scale digits.
   */
  function driverTooltips(series: Series, digits: number, chainName: string, events?: readonly (number | null)[]): TooltipColumn[] {
    const lists = ['issuer_mint', 'issuer_burn', 'bridge_in', 'bridge_out', 'net'].map((flow) => {
      const line = series.lines.find((candidate) => candidate.flow === flow);
      return line ? lineValues(line) : series.buckets.map(() => null);
    });
    const scaled = lists.map((list) => scale(list, digits).values);
    const rowsOf = (index: number): TooltipRow[] =>
      ([
        { flow: 'issuer_mint', marker: 'solid-square', negate: false },
        { flow: 'issuer_burn', marker: 'solid-square', negate: true },
        { flow: 'bridge_in', marker: 'hatched-square', negate: false },
        { flow: 'bridge_out', marker: 'hatched-square', negate: true },
        { flow: 'net', marker: 'bar', negate: false },
      ] as const).map(({ flow, marker, negate }, layer) => {
        const raw = scaled[layer]?.[index] ?? null;
        const value = raw === null ? null : unscale(negate ? -raw : raw, digits);
        return {
          label: texts.flows[flow],
          value: value === null ? texts.noData : axisSigned(value),
          marker,
          flow,
        };
      });
    return series.buckets.map((bucket, index) => {
      const notes: TooltipNote[] = [];
      if (scaled.some((list) => (list[index] ?? null) === null) || events?.[index] === null) notes.push({ text: texts.drivers.gapNote(bucketLabel(bucket)), tone: 'incomplete' });
      if (series.lines.some((line) => line.unreconciled.includes(index))) {
        notes.push({ text: series.period === 'day' ? texts.tags.unreconciledDay : texts.resolution.flagged, tone: 'unreconciled' });
      }
      if (isPartialBucket(bucket, series.period)) notes.push({ text: texts.resolution.partial, tone: 'incomplete' });
      return {
        header: { label: chainName, marker: 'none' },
        hideHeader: true,
        rows: rowsOf(index),
        note: noteOf(notes),
        footer: { label: bucketLabel(bucket), value: texts.resolution.flowSum(texts.resolution.units[series.period] ?? series.period, chainName === texts.drivers.allChains ? chainName.toLowerCase() : chainName) },
        splitBefore: 4,
      };
    });
  }

  return { formatShare, supplyTooltips, driverTooltips };
}
