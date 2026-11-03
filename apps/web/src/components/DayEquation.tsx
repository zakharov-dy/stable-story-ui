import type { Overview } from '@app/contracts';
import {
  coordinate,
  chainInfo,
  affectedTerms,
  checkChips,
  type ChainChecks,
  type CheckChip,
  type Term,
  barsFor,
  chainDay,
  TERMS,
  type Bars,
  type ChainDay,
} from '@app/view';
import {
  addDays,
  formatAmount,
  formatCount,
  formatCompact,
  formatEnds,
  formatShortDay,
  assetName,
  termView,
} from '../view.ts';
import { texts } from '../texts.ts';

// The bars' SVG: zero line in the middle, 380 units of half-width on the shared scale.
const WIDTH = 800;
const HEIGHT = 30;
const CENTER = WIDTH / 2;
const HALF = 380;
const ROW = 10;

const MARKS: Record<CheckChip['tone'], string> = {
  ok: texts.equation.marks.passed,
  bad: texts.equation.marks.failed,
  flag: texts.equation.marks.flagged,
  muted: texts.equation.marks.muted,
};

function checkText(chip: CheckChip, asset: string): string | null {
  switch (chip.kind) {
    case 'passed':
      return texts.equation.checks.passed;
    case 'supply':
      return texts.equation.checks.supply(`${formatAmount(chip.supplyDiff ?? null)} ${asset}`);
    case 'bridge':
      return texts.equation.checks.bridge;
    case 'continuity':
      return texts.equation.checks.continuity;
    case 'continuityFirst':
      return texts.equation.checks.continuityFirst;
    case 'unreconciledDay':
      return texts.equation.checks.unreconciledDay;
    case 'notFlagged':
      return null; // a bare ✓, described by its aria-label
  }
}

function Chips({ checks, day, asset }: { checks: ChainChecks; day: string; asset: string }) {
  return (
    <div className="foot">
      <span className="label">
        {checks.later
          ? texts.equation.latestChecks(...formatEnds(day, checks.reconciliationDay))
          : texts.equation.reconciliation(formatShortDay(day))}
      </span>
      <div className="cks">
        {checks.chips.map((chip) => {
          const text = checkText(chip, asset);
          return (
            <span
              key={chip.kind}
              className={`ck${chip.tone === 'ok' ? '' : ` ${chip.tone}`}`}
              data-chip-kind={chip.kind}
              {...(text === null ? { role: 'img', 'aria-label': texts.equation.notFlagged(formatShortDay(day)) } : {})}
            >
              <span className="m">{MARKS[chip.tone]}</span>
              {text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Waterfall({ bars, label }: { bars: Bars; label: string }) {
  const x = (fraction: number): number => CENTER + fraction * HALF;
  const rect = (className: string, y: number, from: number, to: number) => {
    const left = Math.min(from, to);
    return <rect className={className} x={coordinate(left)} y={y} width={coordinate(Math.abs(to - from))} height={ROW} />;
  };
  const issuerIn = x(bars.issuerIn);
  const issuerOut = x(-bars.issuerOut);
  return (
    <div className="wf">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label}>
        {rect('wf-bar issuer-in', 3, CENTER, issuerIn)}
        {rect('wf-bar bridge-in', 3, issuerIn, x(bars.issuerIn + bars.bridgeIn))}
        {rect('wf-bar issuer-out', 17, issuerOut, CENTER)}
        {rect('wf-bar bridge-out', 17, x(-bars.issuerOut - bars.bridgeOut), issuerOut)}
        <line className="wf-zero" x1={CENTER} x2={CENTER} y1={0} y2={HEIGHT} />
        <line className="wf-net" x1={coordinate(x(bars.net))} x2={coordinate(x(bars.net))} y1={0} y2={HEIGHT} />
      </svg>
    </div>
  );
}

function ChainCard({ overview, day, bars }: { overview: Overview; day: ChainDay; bars: Bars | null }) {
  const asOf = overview.asOf;
  if (asOf === null) return null;
  const info = chainInfo(overview.chains, day.chain);
  const status = overview.status.chains.find((candidate) => candidate.chain === day.chain);
  const asset = assetName(overview);
  const checks = status === undefined ? null : checkChips({
    asOf,
    reconciliation: status.reconciliation,
    unreconciledDays: status.unreconciledDays,
    figuresKnown: day.known,
  });
  const affected = new Set<Term>(affectedTerms(checks));
  const lag = status?.state === 'delayed' ? status.lagHours : null;
  const net = termView('net', day.values.net);
  return (
    <article
      className="card b-chain"
      data-chain-index={info.index}
      data-chain-state={status?.state}
      data-unreconciled={day.unreconciled ? 'true' : undefined}
    >
      <div className="head">
        <span className="chain">
          {info.name} <span className="d">· {formatShortDay(asOf)}</span>
        </span>
        {lag === null ? null : (
          <span className="tag delayed">
            {texts.tags.behindNotClosed(formatCount(lag), formatShortDay(addDays(status?.lastClosedDay ?? asOf, 1)))}
          </span>
        )}
        {day.unreconciled ? <span className="tag unrec">{texts.tags.unreconciledDay}</span> : null}
        {day.events === 0 ? <span className="tag noevents">{texts.tags.closedNoEvents}</span> : null}
      </div>
      <div className="chips">
        {TERMS.filter((term) => term !== 'net').map((term) => {
          const view = termView(term, day.values[term]);
          return (
            <div key={term} className="chip" data-flow={term} data-missing={view.missing ? 'true' : undefined} data-affected={affected.has(term) ? 'true' : undefined}>
              <span className="tl"><span className="sw" data-flow={term} />{texts.equation.terms[term]}</span>
              <span className="chip-v">{view.compact}</span>
              {view.missing ? null : <span className="chip-f">{view.full}</span>}
            </div>
          );
        })}
        <span className="op" aria-hidden="true">{texts.equation.equals}</span>
        <div className="chip net" data-flow="net" data-missing={net.missing ? 'true' : undefined} data-affected={affected.has('net') ? 'true' : undefined}>
          <span className="tl"><span className="sw" data-flow="net" />{texts.equation.terms.net}</span>
          <span className="chip-v">{net.compact}</span>
          {net.missing ? null : <span className="chip-f">{net.full}</span>}
        </div>
      </div>
      {bars === null ? null : (
        <Waterfall
          bars={bars}
          label={texts.equation.bars(
            info.name,
            formatShortDay(asOf),
            formatCompact(bars.inTotal),
            formatCompact(bars.outTotal),
            net.compact,
          )}
        />
      )}
      {checks === null ? null : <Chips checks={checks} day={asOf} asset={asset} />}
    </article>
  );
}

/** Block 02: one card per chain from the dedicated day block (`overview.day`), never a chart series; the chains are never added up. */
export function DayEquation({ overview }: { overview: Overview }) {
  const asOf = overview.asOf;
  if (asOf === null) return null;
  const days = overview.chains.map((chain) => chainDay(overview, chain.slug));
  const bars = barsFor(days);
  return (
    <section className="ab-eq" data-block="day-equation" aria-labelledby="day-equation-title">
      <svg className="defs" width="0" height="0" aria-hidden="true">
        <defs>
          <pattern id="eq-hatch-in" className="hatch hatch-in" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="1.6" height="4" />
          </pattern>
          <pattern id="eq-hatch-out" className="hatch hatch-out" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="1.6" height="4" />
          </pattern>
        </defs>
      </svg>
      <div className="section-h">
        <h2 className="label" id="day-equation-title">
          <span className="ix">{texts.section.label(2)}</span>
          {texts.equation.label} · {formatShortDay(asOf)}
        </h2>
        <p className="sub">{texts.equation.caption}</p>
      </div>
      <div className="eqs">
        {days.map((day, index) => <ChainCard key={day.chain} overview={overview} day={day} bars={bars[index] ?? null} />)}
      </div>
      <p className="wf-cap">{texts.equation.scaleNote}</p>
    </section>
  );
}
