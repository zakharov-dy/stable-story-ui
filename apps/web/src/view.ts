// Client-owned labels bound to portable view logic; all algorithms live in @app/view.
import { createEquation, createFormat, createHistory, createSeries, createTooltip } from '@app/view';
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
