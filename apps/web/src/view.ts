// Client-owned labels bound to portable view logic; all algorithms live in @app/view.
import {
  signOf,
  createEquation,
  createFormat,
  createHistory,
  createSeries,
  createTooltip,
  disabledPeriods,
  historyDays,
} from '@app/view';
import type { Overview } from '@app/contracts';
import type { PeriodId } from '@app/view';
import { texts } from './texts.ts';

/** Board order of the period controls; the view package's PERIODS order is not the display order. */
export const PERIOD_ORDER: readonly PeriodId[] = ['all', '90d', '30d'];

/** The period the page opens on: the first board-order period the server supplies. */
export const defaultPeriod = (overview: Overview): PeriodId =>
  PERIOD_ORDER.find(
    (period) =>
      !disabledPeriods(historyDays(overview)).includes(period) &&
      overview.views[period] !== null,
  ) ?? '30d';

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
