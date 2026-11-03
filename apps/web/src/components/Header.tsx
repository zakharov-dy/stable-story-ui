import type { Kpi, Overview } from '@app/contracts';
import {
  signOf,
  chainInfo,
  splitCompact,
  splitFull,
  fromQuality,
  merge,
  qualityAttribute,
  splitHeaderNotes,
} from '@app/view';
import {
  addDays,
  formatAmount,
  formatCompact,
  formatCount,
  formatDay,
  formatEnds,
  formatPercent,
  formatShortDay,
  assetName,
  beforeHistoryReason,
} from '../view.ts';
import { texts } from '../texts.ts';
import { Coverage } from './Notes.tsx';
import { QualityNote } from './QualityNote.tsx';
import { Sparkline, type SparkSize } from './Sparkline.tsx';

const CARDS = ['supply', 'change1d', 'change7d', 'issuerMinted7d', 'issuerBurned7d'] as const;
type Card = (typeof CARDS)[number];

// Only the changes of the supply carry the direction: a sign, ▲▼ and the positive/negative colours.
// Levels and issuer volumes have no direction, and neither do the percentages of the issuer cards.
const DIRECTED: Record<Card, boolean> = { supply: false, change1d: true, change7d: true, issuerMinted7d: false, issuerBurned7d: false };
const WEEKLY: Record<Card, boolean> = { supply: false, change1d: false, change7d: true, issuerMinted7d: true, issuerBurned7d: true };

const HISTORY_CARDS = new Set<Card>(['change1d', 'change7d', 'issuerMinted7d', 'issuerBurned7d']);

/** The reason a card is cut short by the start of the history, when the quality says the data is incomplete. */
function historyReason(card: Card, kpi: Kpi, overview: Overview): string | null {
  if (kpi.quality.complete || !HISTORY_CARDS.has(card)) return null;
  return beforeHistoryReason(card as Parameters<typeof beforeHistoryReason>[0], overview);
}

/** The reason a percentage is unknown, from the quality the API sent with the card. */
function whyPercentUnknown(card: Card, kpi: Kpi, overview: Overview): string {
  if (kpi.quality.complete) return texts.header.zeroBase;
  return historyReason(card, kpi, overview) ?? (WEEKLY[card] ? texts.na.reasons.previousWeekIncomplete : texts.na.reasons.noDataForRange);
}

function Figure({ value, signed, hero, unit, why }: { value: string | null; signed: boolean; hero: boolean; unit: string; why: string }) {
  if (value === null) {
    return (
      <>
        <p className={`kpi kpi-value na${hero ? ' hero' : ''}`}>{texts.na.label}</p>
        <p className="na-why">{why}</p>
      </>
    );
  }
  const compact = splitCompact(formatCompact(value, { signed }));
  const full = splitFull(formatAmount(value, { signed }));
  return (
    <>
      <p className={`kpi kpi-value${hero ? ' hero' : ''}`}>
        {compact.number}
        {compact.suffix === '' ? null : <span className="sfx">{compact.suffix}</span>}
      </p>
      <p className="full">
        {full.whole}
        {full.fraction === '' ? null : <span className="frac">{full.fraction}</span>}
        <span className="u">{unit}</span>
      </p>
    </>
  );
}

function Change({ card, kpi, overview }: { card: Card; kpi: Kpi; overview: Overview }) {
  // The 7-day card names the compared day: the last closed day minus 7 days. Every other card
  // keeps its static reference; a missing day list (no header days) shows no reference.
  const last = overview.header.days.at(-1);
  let reference: string;
  if (card === 'change7d') {
    reference = last === undefined ? '' : texts.header.changePct.change7d(formatShortDay(addDays(last, -7)));
  } else {
    reference = texts.header.changePct[card];
  }
  if (kpi.changePct === null) {
    return (
      <p className="chg">
        <span className="na">{texts.na.label}</span> <span className="na-why">{whyPercentUnknown(card, kpi, overview)}</span>
      </p>
    );
  }
  const sign = signOf(kpi.changePct);
  const directed = DIRECTED[card] && sign !== 'zero';
  const tone = !directed ? 'neutral' : sign === 'negative' ? 'negative' : 'positive';
  const arrow = !directed ? '' : `${sign === 'negative' ? texts.header.sign.down : texts.header.sign.up} `;
  return (
    <p className="chg">
      <span className={tone === 'positive' ? 'pos' : tone === 'negative' ? 'neg' : 'neu'} data-tone={tone}>
        {arrow}{formatPercent(kpi.changePct, { signed: true })}
      </span>{' '}
      {reference}
    </p>
  );
}

function KpiCard({ card, kpi, overview, size }: { card: Card; kpi: Kpi; overview: Overview; size: SparkSize }) {
  const { header } = overview;
  const summary = fromQuality(kpi.quality);
  const directed = DIRECTED[card];
  const first = header.days[0];
  const last = header.days.at(-1);
  const sparkLabel = first !== undefined && last !== undefined
    ? texts.header.spark.label(texts.header.cards[card], ...formatEnds(first, last))
    : texts.header.cards[card];
  const spark = (
    <Sparkline days={header.days} values={kpi.spark} unreconciled={kpi.sparkUnreconciled} label={sparkLabel} signed={directed} size={size} />
  );
  const flagged = kpi.sparkUnreconciled.length > 0 ? 'true' : undefined;
  const quality = qualityAttribute(summary);
  const unit = assetName(overview);
  // A value that is n/a for want of history says which day it needs; otherwise there is no data.
  const why = historyReason(card, kpi, overview) ?? texts.na.reasons.noDataForRange;
  if (card === 'supply') {
    return (
      <div className="a-mon" data-kpi={card} data-quality={quality} data-unreconciled={flagged}>
        <span className="label">{texts.header.cards[card]}</span>
        <Figure value={kpi.value} signed={false} hero unit={unit} why={why} />
        <Coverage overview={overview} />
        {spark}
      </div>
    );
  }
  const big = card === 'change1d';
  return (
    <article className={`card${big ? ' a-day' : ''}`} data-kpi={card} data-quality={quality} data-unreconciled={flagged}>
      {big ? (
        <div className="head">
          <span className="label">{texts.header.cards[card]}</span>
          <span className="chg">{last === undefined ? null : formatShortDay(last)}</span>
        </div>
      ) : (
        <span className="label">{texts.header.cards[card]}</span>
      )}
      <div className="vals">
        <Figure value={kpi.value} signed={directed} hero={false} unit={unit} why={why} />
        <Change card={card} kpi={kpi} overview={overview} />
      </div>
      {spark}
    </article>
  );
}

/** Block 01: the supply monument beside the day's change, then the 7-day band; the date, a delayed chain and missing data above. */
export function Header({ overview }: { overview: Overview }) {
  const { header } = overview;
  const summary = merge(CARDS.map((card) => fromQuality(header[card].quality)));
  const { above, below } = splitHeaderNotes(summary);
  const delayed = overview.status.chains.filter((status) => status.state === 'delayed' && status.lagHours !== null);
  const names = delayed.map((status) => chainInfo(overview.chains, status.chain).name);
  // A chain whose last closed day is among its mismatched days.
  const unreconciled = overview.status.chains.flatMap((status) =>
    status.lastClosedDay !== null && status.unreconciledDays.includes(status.lastClosedDay)
      ? [{ chain: status.chain, day: status.lastClosedDay }]
      : []);
  const delayedNote = names.length === 0 || overview.asOf === null ? null : texts.states.delayed(names, formatShortDay(overview.asOf));
  return (
    <section className="ab-header" data-block="header" data-quality={qualityAttribute(summary)} aria-labelledby="header-title">
      <div className="a-meta">
        <h2 className="label" id="header-title">
          <span className="ix">{texts.section.label(1)}</span>
          {texts.header.label}
        </h2>
        <div className="date-row">
          {overview.asOf === null ? null : <p className="date">{texts.asOf(formatDay(overview.asOf))}</p>}
          {delayed.map((status) => (
            <span key={status.chain} className="tag delayed">
              {texts.tags.behind(chainInfo(overview.chains, status.chain).name, formatCount(status.lagHours))}
            </span>
          ))}
          {unreconciled.map(({ chain, day }) => (
            <span key={chain} className="tag unrec">
              {texts.tags.chainUnreconciled(chainInfo(overview.chains, chain).name, formatShortDay(day))}
            </span>
          ))}
        </div>
      </div>
      <QualityNote summary={above} delayed={delayedNote} />
      <div className="a-hero">
        <KpiCard card="supply" kpi={header.supply} overview={overview} size="tall" />
        <KpiCard card="change1d" kpi={header.change1d} overview={overview} size="tall" />
      </div>
      <div className="a-band">
        {(['change7d', 'issuerMinted7d', 'issuerBurned7d'] as const).map((card) => (
          <KpiCard key={card} card={card} kpi={header[card]} overview={overview} size="compact" />
        ))}
      </div>
      <p className="inote a-foot">
        <strong>{texts.header.issuerNote.term}</strong>
        {texts.header.issuerNote.body}
      </p>
      <QualityNote summary={below} />
    </section>
  );
}
