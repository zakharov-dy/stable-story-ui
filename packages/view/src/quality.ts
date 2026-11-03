// Quality flags shown next to the affected blocks. Kpi, Split, EventsPage and RecordItem
// carry a Quality; a Series carries only bucket completeness and unreconciled point indices.
import { isPartialBucket } from './resolution.ts';
import type { Quality, Series } from '@app/contracts';

export type QualityFlag = 'incomplete' | 'unreconciled' | 'operations-incomplete' | 'unpaired';

export interface QualitySummary {
  flags: QualityFlag[];
  unreconciledDays: string[]; // ascending, unique
  unpairedEvents: number;
  partial?: boolean;
  aggregated?: boolean;
}

const ORDER: readonly QualityFlag[] = ['incomplete', 'unreconciled', 'operations-incomplete', 'unpaired'];

export function fromQuality(quality: Quality): QualitySummary {
  const flags: QualityFlag[] = [];
  if (!quality.complete) flags.push('incomplete');
  if (quality.unreconciledDays.length > 0) flags.push('unreconciled');
  if (!quality.operationsComplete) flags.push('operations-incomplete');
  if (quality.unpairedEvents > 0) flags.push('unpaired');
  return { flags, unreconciledDays: [...quality.unreconciledDays], unpairedEvents: quality.unpairedEvents };
}

/** A series: incomplete buckets and points flagged unreconciled; the days are those of the flagged buckets. */
export function fromSeries(series: Series): QualitySummary {
  const flags: QualityFlag[] = [];
  if (series.lines.some((line) => line.values.includes(null))) flags.push('incomplete');
  const days = new Set<string>();
  for (const line of series.lines) {
    for (const index of line.unreconciled) {
      const bucket = series.buckets[index];
      if (bucket) days.add(bucket.end);
    }
  }
  if (days.size > 0) flags.push('unreconciled');
  return { flags, unreconciledDays: series.period === 'day' ? [...days].sort() : [], unpairedEvents: 0, partial: series.buckets.some((bucket) => isPartialBucket(bucket, series.period)), aggregated: series.period !== 'day' };
}

/** The union of several summaries; unpaired counts are not added up, the largest is kept. */
export function merge(summaries: readonly QualitySummary[]): QualitySummary {
  const flags = new Set(summaries.flatMap((summary) => summary.flags));
  const days = new Set(summaries.flatMap((summary) => summary.unreconciledDays));
  return {
    partial: summaries.some((summary) => summary.partial),
    aggregated: summaries.some((summary) => summary.aggregated),
    flags: ORDER.filter((flag) => flags.has(flag)),
    unreconciledDays: [...days].sort(),
    unpairedEvents: Math.max(0, ...summaries.map((summary) => summary.unpairedEvents)),
  };
}

/** The `.qnote` variant class of a flag: unreconciled is the default look, gaps and unpaired events have their own. */
export const noteVariant = (flag: QualityFlag): '' | 'gapn' | 'unpairedn' =>
  flag === 'unreconciled' ? '' : flag === 'unpaired' ? 'unpairedn' : 'gapn';

/** The data-quality attribute: `ok` or the flags separated by spaces. */
export const qualityAttribute = (summary: QualitySummary): string =>
  summary.flags.length === 0 ? 'ok' : summary.flags.join(' ');

const COVERAGE: readonly QualityFlag[] = ['incomplete', 'operations-incomplete'];

/**
 * The header notes in two places: missing data goes up beside the date (like a delayed chain),
 * everything else below the issuer note. Operation counts follow missing data when it is flagged;
 * on their own they stay below.
 */
export function splitHeaderNotes(summary: QualitySummary): { above: QualitySummary; below: QualitySummary } {
  const up: readonly QualityFlag[] = summary.flags.includes('incomplete') ? COVERAGE : [];
  return {
    above: { ...summary, flags: summary.flags.filter((flag) => up.includes(flag)) },
    below: { ...summary, flags: summary.flags.filter((flag) => !up.includes(flag)) },
  };
}
