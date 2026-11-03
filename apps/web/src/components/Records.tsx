import type { Overview, RecordItem } from '@app/contracts';
import { formatCompact, formatDay } from '../view.ts';
import { texts } from '../texts.ts';
import { fromQuality, merge, qualityAttribute } from '@app/view';
import { AmountDigits, EventsTable } from './EventRow.tsx';
import { QualityNote } from './QualityNote.tsx';
import { SectionHeading } from './SectionHeading.tsx';

/** "41.86B" → ["41.86", "B"]: the unit letter is set smaller next to the figure. */
function splitUnit(compact: string): [string, string] {
  const match = /^(.*?)([A-Za-z]*)$/.exec(compact);
  return [match?.[1] ?? compact, match?.[2] ?? ''];
}

/** Why a record has no value: undefined operation counts, or nothing in the searched range. */
const missingReason = (record: RecordItem): string =>
  record.kind === 'largest_event' && !record.quality.operationsComplete
    ? texts.na.reasons.operationsIncomplete
    : texts.na.reasons.noDataForRange;

function RecordFigure({ record, unit }: { record: RecordItem; unit: string }) {
  if (record.value === null) {
    return (
      <>
        <p className="rec-kpi na">{texts.na.label}</p>
        <p className="rec-reason">{missingReason(record)}</p>
      </>
    );
  }
  const [figure, suffix] = splitUnit(formatCompact(record.value));
  return (
    <>
      <p className="rec-kpi">{figure}{suffix === '' ? null : <span className="sfx">{suffix}</span>}</p>
      <p className="rec-full"><AmountDigits value={record.value} /><span className="u">{unit}</span></p>
    </>
  );
}

/** /// 07: record cards for scope 'all' (the default view), searched since historyStart. */
export function Records({ overview }: { overview: Overview }) {
  const records = overview.records.filter((record) => record.scope === 'all');
  const summary = merge(records.map((record) => fromQuality(record.quality)));
  const unit = texts.assetNames[overview.asset] ?? overview.asset.toUpperCase();
  const since = records[0]?.since;
  // Without an operation card (its value is n/a) the other cards fill one row of four.
  const withOperation = records.some((record) => record.event);
  return (
    <section className="sec" data-block="records" data-quality={qualityAttribute(summary)} aria-labelledby="h-records">
      <SectionHeading
        index={7}
        label={texts.records.label}
        title={texts.records.title}
        caption={texts.records.caption(since === undefined ? null : formatDay(since))}
        id="h-records"
      />
      <QualityNote summary={summary} />
      <div className={withOperation ? 'recs' : 'recs four'}>
        {records.map((record) => (
          <article
            key={record.kind}
            className={`card rec${record.event ? ' op' : ''}`}
            data-record={record.kind}
            data-quality={qualityAttribute(fromQuality(record.quality))}
          >
            <div>
              <span className="label">{texts.records.kinds[record.kind]}</span>
              <RecordFigure record={record} unit={unit} />
              {record.day === null ? null : <p className="when">{formatDay(record.day)}</p>}
            </div>
            {record.event ? <EventsTable rows={[record.event]} chains={overview.chains} variant="record" /> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
