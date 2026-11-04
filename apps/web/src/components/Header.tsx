import type { Overview } from '@app/contracts';
import {
  coordinate,
  fraction,
  maxOf,
  scale,
  TERMS,
  signedValue,
  fromQuality,
  qualityAttribute,
} from '@app/view';
import { formatCompact, formatShortDay, roundedChange, tone } from '../view.ts';
import { texts } from '../texts.ts';

/** Only coordinates accumulate. All five labels, including net, come from the scope-all row. */
function Waterfall({ overview }: { overview: Overview }) {
  const row = overview.day?.rows.find((candidate) => candidate.scope === 'all');
  const values = TERMS.map((term) =>
    signedValue(term, row?.values[term] ?? null),
  );
  const scaled = scale(values).values;
  const known = scaled.every((value) => value !== null);
  let position = 0n;
  const edges = scaled.map((value, index) => {
    const start = index === 4 ? 0n : position;
    position = start + (value ?? 0n);
    return [start, position] as const;
  });
  const bound =
    maxOf(edges.flat().map((value) => (value < 0n ? -value : value))) ?? 0n;
  const y = (value: bigint) => 60 - fraction(value, 0n, bound || 1n) * 50;
  return (
    <figure
      className="waterfall"
      data-block="waterfall"
      data-quality={
        row?.unreconciled ? 'unreconciled' : known ? 'ok' : 'incomplete'
      }
    >
      {known ? (
        <svg
          className="wf-plot"
          viewBox="0 0 520 120"
          role="img"
          aria-label={texts.header.waterfall(
            overview.day === null
              ? texts.noData
              : formatShortDay(overview.day.date),
          )}
        >
          <defs>
            {(['bridge_in', 'bridge_out'] as const).map((flow) => (
              <pattern
                key={flow}
                id={`waterfall-${flow}`}
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect data-flow={flow} width="1.6" height="4" />
              </pattern>
            ))}
          </defs>
          <line className="wf-zero" x1="0" x2="520" y1="60" y2="60" />
          {edges.map(([start, end], index) => (
            <g key={TERMS[index]}>
              {index < 4 ? (
                <line
                  className="wf-connector"
                  x1={index * 104 + 78}
                  x2={(index + 1) * 104 + 26}
                  y1={coordinate(y(end))}
                  y2={coordinate(y(end))}
                />
              ) : null}
              <rect
                data-flow={TERMS[index]}
                data-unreconciled={
                  index === 4 && row?.unreconciled ? 'true' : undefined
                }
                x={index * 104 + 26}
                y={coordinate(Math.min(y(start), y(end)))}
                width="52"
                height={coordinate(Math.max(1, Math.abs(y(start) - y(end))))}
              />
            </g>
          ))}
        </svg>
      ) : null}
      <div className="wf-row">
        {TERMS.map((term, index) => (
          <div key={term} data-flow={term}>
            <div className="wf-v">{roundedChange(values[index] ?? null)}</div>
            <div className="wf-c">
              <span className="sw" data-flow={term} />
              {texts.flows[term]}
            </div>
          </div>
        ))}
      </div>
      <figcaption className="wf-cap">
        <span className="ix">{texts.header.marker}</span>{' '}
        {overview.day === null
          ? texts.noData
          : texts.header.waterfall(formatShortDay(overview.day.date))}
      </figcaption>
    </figure>
  );
}

export function Header({ overview }: { overview: Overview }) {
  return (
    <section
      className="hero"
      id="hero"
      data-block="header"
      data-quality={qualityAttribute(
        fromQuality(overview.header.supply.quality),
      )}
      aria-label={texts.header.cards.supply}
    >
      <div>
        <p className="monument" aria-label={texts.header.cards.supply}>
          {formatCompact(overview.header.supply.value)}
        </p>
        <p className="delta">
          <span className={tone(overview.header.change1d.value)}>
            {texts.header.today(roundedChange(overview.header.change1d.value))}
          </span>
          <span className="sep"> · </span>
          <span className={tone(overview.header.change7d.value)}>
            {texts.header.week(roundedChange(overview.header.change7d.value))}
          </span>
        </p>
        {overview.status.chains
          .filter((status) =>
            status.unreconciledDays.includes(overview.asOf ?? ''),
          )
          .map((status) => (
            <p
              key={status.chain}
              className="hero-note unrec"
              data-unreconciled="true"
            >
              {texts.header.failed(
                overview.chains.find((chain) => chain.slug === status.chain)
                  ?.name ?? status.chain,
                formatShortDay(overview.asOf!),
                (['supply', 'bridge', 'continuity'] as const)
                  .filter(
                    (check) => status.reconciliation?.[check] === 'mismatch',
                  )
                  .map((check) =>
                    texts.status.failure(texts.status.checks[check]),
                  )
                  .join(', '),
              )}
            </p>
          ))}
        {overview.header.supply.quality.complete ? null : (
          <p className="hero-note" data-quality="incomplete">
            {texts.quality.incomplete}
          </p>
        )}
      </div>
      <Waterfall overview={overview} />
    </section>
  );
}
