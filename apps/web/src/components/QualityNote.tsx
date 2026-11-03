import { formatDays } from '../view.ts';
import { texts } from '../texts.ts';
import { type QualityFlag, type QualitySummary, noteVariant } from '@app/view';

/**
 * The quality of a block in words, next to it; nothing when the block is complete and reconciled.
 * `delayed` is the text of a delayed-chain note (the delay itself comes from the chain status, not
 * from a quality flag); it is shown first. `step` names the bucket of a chart (day, week, month):
 * the shaded-columns note names it from the series' period, never assumes days.
 */
export function QualityNote({ summary, points = false, delayed = null, step = 'day' }: { summary: QualitySummary; points?: boolean; delayed?: string | null; step?: string }) {
  if (summary.flags.length === 0 && !summary.partial && delayed === null) return null;
  return (
    <ul className="qnotes" aria-label={texts.quality.title}>
      {delayed === null ? null : (
        <li className="qnote delayed" data-flag="delayed">
          <span className="k">{texts.quality.kinds.delayed}</span>
          <p>{delayed}</p>
        </li>
      )}
      {summary.partial ? <li className="qnote gapn" data-flag="partial"><p>{texts.resolution.partial}</p></li> : null}
      {summary.flags.map((flag) => (
        <li key={flag} className={`qnote ${noteVariant(flag)}`.trim()} data-flag={flag}>
          <span className="k">{texts.quality.kinds[kindOf(flag)]}</span>
          <p>{message(flag, summary, points, step)}</p>
        </li>
      ))}
    </ul>
  );
}

const kindOf = (flag: QualityFlag): 'unreconciled' | 'incomplete' | 'unpaired' =>
  flag === 'operations-incomplete' ? 'incomplete' : flag;

function message(flag: QualityFlag, summary: QualitySummary, points: boolean, step: string): string {
  switch (flag) {
    case 'incomplete':
      return points ? texts.quality.incompleteBuckets(step) : texts.quality.incomplete;
    case 'unreconciled': {
      if (summary.aggregated) return texts.resolution.flagged;
      const text = texts.quality.unreconciled(formatDays(summary.unreconciledDays));
      return points ? `${text} ${texts.quality.unreconciledPoints}` : text;
    }
    case 'operations-incomplete':
      return texts.quality.operationsIncomplete;
    case 'unpaired':
      return texts.quality.unpaired(summary.unpairedEvents);
  }
}
