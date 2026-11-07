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
        {page.items.length > 5 ? (
          <details className="operations-more">
            <summary className="disclosure">
              {texts.feed.showAll(page.items.length)}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M3 7.5l3-3 3 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            {page.items.slice(5).map((row) => (
              <OperationRow key={row.id} row={row} chains={overview.chains} />
            ))}
          </details>
        ) : null}
      </div>
      {page.items.length === 0 ? (
        <p className="sub">{texts.feed.none}</p>
      ) : null}
    </section>
  );
}
