// Public windows are selected by the server; the page only selects a declared view.
import type { Overview } from '@app/contracts';

export const PERIODS = ['30d', '90d', 'all'] as const;
export type PeriodId = (typeof PERIODS)[number];

/** Inclusive UTC calendar coverage, independent of the number of public buckets. */
export function historyDays({ historyStart, asOf }: Pick<Overview, 'historyStart' | 'asOf'>): number {
  if (historyStart === null || asOf === null) return 0;
  return Math.round((Date.parse(asOf + 'T00:00:00Z') - Date.parse(historyStart + 'T00:00:00Z')) / 86_400_000) + 1;
}

export function disabledPeriods(days: number): readonly PeriodId[] {
  return [...(days < 90 ? (['90d'] as const) : []), ...(days <= 90 ? (['all'] as const) : [])];
}
