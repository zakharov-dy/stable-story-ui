import type { Overview } from '@app/contracts';
import { fromQuality, qualityAttribute } from '@app/view';
import { texts } from '../texts.ts';
import { formatRange } from '../view.ts';
import { OperationRow } from './EventRow.tsx';

export function Feed({ overview }: { overview: Overview }) {
  const page = overview.largestEvents;
  return (
    <section
      className="block"
      data-block="feed"
      data-quality={qualityAttribute(fromQuality(page.quality))}
      aria-labelledby="h-feed"
    >
      <div className="sec-head">
        <h2 id="h-feed">
          {texts.feed.title}{' '}
          <span className="dim">
            ·{' '}
            {texts.feed.window(
              page.from === null || page.to === null
                ? texts.noData
                : formatRange(page.from, page.to),
            )}
          </span>
        </h2>
      </div>
      <div className="oplist">
        {page.items.slice(0, 5).map((row) => (
          <OperationRow key={row.id} row={row} chains={overview.chains} />
        ))}
      </div>
      {page.items.length === 0 ? (
        <p className="sub">{texts.feed.none}</p>
      ) : null}
      {page.items.length > 5 ? (
        <details className="operations-more">
          <summary>
            <span className="when-closed">
              {texts.feed.showAll(page.items.length)}
            </span>
            <span className="when-open">{texts.feed.showFive}</span>
          </summary>
          <div className="oplist">
            {page.items.slice(5).map((row) => (
              <OperationRow key={row.id} row={row} chains={overview.chains} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
