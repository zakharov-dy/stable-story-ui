// Client-owned labels bound to portable view logic; all algorithms live in @app/view.
import {
  signOf,
  createEquation,
  createFormat,
  createHistory,
  createSeries,
  createTooltip,
} from '@app/view';
import { texts } from './texts.ts';

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
  signOf(value) === 'negative' ? 'neg' : 'pos';

/** Month labels use the supplied bucket date without changing the bucket. */
export const formatMonth = (day: string): string =>
  `${texts.months[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;
