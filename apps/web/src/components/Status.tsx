import type { ChainStatus, Overview } from '@app/contracts';
import type { ReactNode } from 'react';
import { formatAmount, formatCount, formatDays, formatRunTime, formatShortDay } from '../view.ts';
import { texts } from '../texts.ts';
import { chainInfo } from '@app/view';
import { SectionHeading } from './SectionHeading.tsx';

type Reconciliation = NonNullable<ChainStatus['reconciliation']>;

/** The label of a cell in the card layout (hidden in the wide table, where the column header says it). */
const CellLabel = ({ children }: { children: ReactNode }) => <span className="k">{children}</span>;

/**
 * The three checks as small chips. A mismatch is the only alarm; continuity "none" is the chain's
 * first day (nothing to continue from), a neutral chip with the reason.
 */
function Checks({ reconciliation }: { reconciliation: Reconciliation }) {
  const names = ['supply', 'bridge', 'continuity'] as const;
  return (
    <ul className="c3s">
      {names.map((name) => {
        const result = reconciliation[name];
        const bad = result === 'mismatch';
        return (
          <li key={name} className={bad ? 'c3 bad' : 'c3'} data-check={result}>
            <span className="m" aria-hidden="true">{texts.status.checkMarks[result]}</span>
            {result === 'none' ? `${texts.status.checks[name]} · ${texts.status.firstDay}` : texts.status.checks[name]}
            {result === 'none' ? null : <span className="sr">{texts.status.checkResults[result]}</span>}
            {name === 'supply' && bad ? <span className="diff">{texts.status.supplyDiff(formatAmount(reconciliation.supplyDiff, { signed: true }))}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** ok: calm text; delayed: the lag as a tag; unreconciled: a tag; no_data: a "no data" tag. */
function State({ status, chain }: { status: ChainStatus; chain: string }) {
  switch (status.state) {
    case 'ok':
      return <span className="sv muted"><span className="pos" aria-hidden="true">{texts.status.checkMarks.ok}</span> {texts.status.states.ok}</span>;
    case 'delayed':
      return (
        <span className="tag delayed">
          {status.lagHours === null ? texts.status.states.delayed : <span className="lag">{texts.tags.behind(chain, formatCount(status.lagHours))}</span>}
        </span>
      );
    case 'unreconciled':
      return <span className="tag unrec">{texts.status.states.unreconciled}</span>;
    case 'no_data':
      return <span className="tag nodata">{texts.status.states.no_data}</span>;
  }
}

function LastRun({ lastRun }: { lastRun: ChainStatus['lastRun'] }) {
  if (lastRun === null) return <span className="sv muted">{texts.noData}</span>;
  return (
    <span className="sv" data-run-status={lastRun.status}>
      {texts.status.run(formatRunTime(lastRun.finishedAt), texts.status.runStatus[lastRun.status])}
    </span>
  );
}

function StatusRow({ status, chains }: { status: ChainStatus; chains: Overview['chains'] }) {
  const chain = chainInfo(chains, status.chain);
  const columns = texts.status.columns;
  const mismatched = status.unreconciledDays.length > 0;
  return (
    <tr data-chain={status.chain} data-chain-state={status.state} role="row">
      <th scope="row" role="rowheader"><span className="chain" data-chain-index={chain.index}>{chain.name}</span></th>
      <td role="cell" className="st"><CellLabel>{columns.state}</CellLabel><State status={status} chain={chain.name} /></td>
      {status.state === 'no_data' ? (
        <td role="cell" className="rest" colSpan={5}>{texts.status.noClosedDay}</td>
      ) : (
        <>
          <td role="cell"><CellLabel>{columns.lastClosedDay}</CellLabel><span className="sv">{status.lastClosedDay === null ? texts.noData : formatShortDay(status.lastClosedDay)}</span></td>
          <td role="cell"><CellLabel>{columns.lastBlock}</CellLabel><span className="sv">{formatCount(status.lastBlock)}</span></td>
          <td role="cell" className="wide">
            <CellLabel>{status.reconciliation === null ? columns.reconciliation : texts.status.checksOn(formatShortDay(status.reconciliation.day))}</CellLabel>
            {status.reconciliation === null ? <span className="sv muted">{texts.noData}</span> : <Checks reconciliation={status.reconciliation} />}
          </td>
          <td role="cell" className="wide"><CellLabel>{columns.lastRun}</CellLabel><LastRun lastRun={status.lastRun} /></td>
          <td role="cell" data-unreconciled={mismatched ? 'true' : undefined}>
            <CellLabel>{columns.unreconciledDays}</CellLabel>
            <span className={mismatched ? 'sv' : 'sv muted'}>
              {mismatched ? formatDays(status.unreconciledDays).join(', ') : texts.status.none}
            </span>
          </td>
        </>
      )}
    </tr>
  );
}

/** /// 08: freshness and reconciliation of each enabled chain. */
export function Status({ overview }: { overview: Overview }) {
  const unreconciled = overview.status.chains.some((status) => status.unreconciledDays.length > 0);
  const columns = texts.status.columns;
  return (
    <section className="sec" data-block="status" data-quality={unreconciled ? 'unreconciled' : 'ok'} aria-labelledby="h-status">
      <SectionHeading index={8} label={texts.status.label} title={texts.status.title} caption={texts.status.caption} id="h-status" />
      <div className="rows-c" data-variant="status">
        <div className="tbl">
          <table className="status" role="table" aria-labelledby="h-status">
            <thead role="rowgroup">
              <tr role="row">
                {(['chain', 'state', 'lastClosedDay', 'lastBlock', 'reconciliation', 'lastRun', 'unreconciledDays'] as const).map((column) => (
                  <th key={column} scope="col" role="columnheader">{columns[column]}</th>
                ))}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {overview.status.chains.map((status) => <StatusRow key={status.chain} status={status} chains={overview.chains} />)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
