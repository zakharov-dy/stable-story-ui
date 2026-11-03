import type { Overview } from '@app/contracts';
import { formatRange } from '../view.ts';
import { texts } from '../texts.ts';
import { fromQuality, qualityAttribute } from '@app/view';
import { EventsTable } from './EventRow.tsx';
import { QualityNote } from './QualityNote.tsx';
import { SectionHeading } from './SectionHeading.tsx';

/** /// 06: the largest rows over seven days, unpaired and unreconciled rows marked. */
export function Feed({ overview }: { overview: Overview }) {
  const page = overview.largestEvents;
  const summary = fromQuality(page.quality);
  const range = page.from === null || page.to === null ? null : formatRange(page.from, page.to);
  return (
    <section className="sec" data-block="feed" data-quality={qualityAttribute(summary)} aria-labelledby="h-feed">
      <SectionHeading index={6} label={texts.feed.label} title={texts.feed.title(page.items.length)} caption={texts.feed.caption(range)} id="h-feed" />
      <QualityNote summary={summary} />
      {page.items.length === 0 ? (
        <p className="muted">{texts.feed.none}</p>
      ) : (
        <EventsTable rows={page.items} chains={overview.chains} variant="feed" labelledBy="h-feed" />
      )}
    </section>
  );
}
