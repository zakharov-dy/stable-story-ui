// Client-owned labels bound to portable view logic; all algorithms live in @app/view.
import {
  signOf,
  createEquation,
  createFormat,
  createHistory,
  createSeries,
  createTooltip,
  historyDays,
} from '@app/view';
import type { Overview } from '@app/contracts';
import type { PeriodId } from '@app/view';
import { texts } from './texts.ts';

/** Board order of the period controls; the view package's PERIODS order is not the display order. */
export const PERIOD_ORDER: readonly PeriodId[] = ['all', '90d', '30d'];

/**
 * Availability on the page: ALL needs more than 90 days of history; 90D and 30D follow the server's
 * views. Short history keeps 90D selectable, so the board default falls back to 90D, not 30D.
 */
export const offPeriods = (overview: Overview): ReadonlySet<PeriodId> => {
  const off = new Set<PeriodId>();
  if (overview.views.all === null || historyDays(overview) <= 90) off.add('all');
  if (overview.views['90d'] === null) off.add('90d');
  if (overview.views['30d'] === null) off.add('30d');
  return off;
};

/** The period the page opens on: the first board-order period the server supplies. */
export const defaultPeriod = (overview: Overview): PeriodId =>
  PERIOD_ORDER.find((period) => !offPeriods(overview).has(period)) ?? '30d';

export const {
  formatAmount,
  formatCompact,
  formatPercent,
  formatCount,
  formatDay,
  formatShortDay,
  addDays,
  formatEnds,
  formatRange,
  formatHistoryRange,
  formatDays,
  formatTime,
  formatRunTime,
  assetName,
  termView,
  beforeHistoryReason,
  formatSeriesValue,
  bucketLabel,
  runLabel,
  axisSigned,
  naReason,
  shortDay,
  formatShare,
  supplyTooltips,
  driverTooltips,
} = {
  ...createFormat(texts),
  ...createEquation(texts),
  ...createHistory(texts),
  ...createSeries(texts),
  ...createTooltip(texts),
};

export const roundedChange = (value: string | null): string =>
  formatCompact(value, {
    signed: true,
    places:
      value !== null && value.replace('-', '').split('.')[0].length >= 10
        ? 2
        : 0,
  });
export const tone = (value: string | null): string =>
  value === null ? 'neutral' : signOf(value) === 'negative' ? 'neg' : 'pos';

/** Month labels use the supplied bucket date without changing the bucket. */
export const formatMonth = (day: string): string =>
  `${texts.months[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;
