// What the page says when the common history is shorter than a view needs: the dates come
// from the overview (`asOf`, `historyStart`, the first day of the 30-day windows), never from a guess.
import type { ViewLabels } from './labels.ts';
import { createFormat } from './format.ts';
import type { Overview } from '@app/contracts';

export type HistoryCard = 'change1d' | 'change7d' | 'issuerMinted7d' | 'issuerBurned7d';

// How many days before asOf the first day of the comparison reaches: the day a change is measured
// from, or the start of the previous 7-day window (asOf − 13 … asOf − 7).
const LOOKBACK: Record<HistoryCard, number> = { change1d: 1, change7d: 7, issuerMinted7d: 13, issuerBurned7d: 13 };

/** The common history starts after the first day of the 30-day windows: the whole-history chart is short. */
export function isShortHistory({ historyStart, header }: Pick<Overview, 'historyStart' | 'header'>): boolean {
  const windowStart = header.days[0];
  return historyStart !== null && windowStart !== undefined && windowStart < historyStart;
}

/** Bind client-owned labels without global configuration. */
export function createHistory(texts: ViewLabels) {
  const { addDays, formatDays, formatRange } = createFormat(texts);

  /**
   * Why a card's change is unknown when the cause is the start of the history: the day it needs lies
   * before `historyStart`. null when asOf or historyStart is unknown or the history is long enough.
   */
  function beforeHistoryReason(card: HistoryCard, { asOf, historyStart }: Pick<Overview, 'asOf' | 'historyStart'>): string | null {
    if (asOf === null || historyStart === null) return null;
    const needed = addDays(asOf, -LOOKBACK[card]);
    if (needed >= historyStart) return null;
    if (LOOKBACK[card] === 13) {
      // The previous 7-day window: the part of it that lies before the history starts.
      const dayBefore = addDays(historyStart, -1);
      const windowEnd = addDays(asOf, -7);
      return texts.na.history.before(formatRange(needed, dayBefore < windowEnd ? dayBefore : windowEnd));
    }
    const [day, start] = formatDays([needed, historyStart]);
    return texts.na.history.needs(day ?? '', start ?? '');
  }

  return { beforeHistoryReason };
}
