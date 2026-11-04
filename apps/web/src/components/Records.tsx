import type { Overview } from '@app/contracts';
import { fromQuality, merge, qualityAttribute } from '@app/view';
import { texts } from '../texts.ts';
import { formatCompact, formatDay } from '../view.ts';

export function Records({ overview }: { overview: Overview }) {
  const records = overview.records.filter((record) => record.scope === 'all');
  const since = records[0]?.since;
  return (
    <section
      className="block"
      data-block="records"
      data-quality={qualityAttribute(
        merge(records.map((record) => fromQuality(record.quality))),
      )}
      aria-labelledby="h-records"
    >
      <div className="sec-head">
        <h2 id="h-records">
          {texts.records.title}{' '}
          {since === undefined ? null : (
            <span className="dim">
              · {texts.records.since(formatDay(since))}
            </span>
          )}
        </h2>
      </div>
      <ul className="rline">
        {records.map((record) => (
          <li
            key={`${record.scope}-${record.kind}`}
            data-record={record.kind}
            data-quality={qualityAttribute(fromQuality(record.quality))}
          >
            <span className="rk">{texts.records.kinds[record.kind]}</span>
            <span className="rv">{record.value === null ? texts.na.label : formatCompact(record.value)}</span>
            {record.value === null ? (
              <span className="rd">{texts.na.reasons.noDataForRange}</span>
            ) : null}
            {record.day === null ? null : (
              <span className="rd">{formatDay(record.day)}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
