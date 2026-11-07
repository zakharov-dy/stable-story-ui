import type { Overview } from '@app/contracts';
import { texts } from '../texts.ts';
import {
  formatCount,
  formatDay,
  formatDays,
  formatRunTime,
  formatShortDay,
} from '../view.ts';

export function ChainDots({ overview }: { overview: Overview }) {
  return (
    <>
      {overview.chains.map((chain, index) => {
        const status = overview.status.chains.find(
          (candidate) => candidate.chain === chain.slug,
        );
        return (
          <span
            key={chain.slug}
            className={`cdot ${status?.state ?? ''}`}
            data-chain-index={index + 1}
            data-chain-state={status?.state}
            data-quality={
              status?.state === 'no_data' ? 'incomplete' : status?.state
            }
          >
            <span className="dot" />
            <span className="chain-full">{chain.name}</span>
            <span className="chain-short">
              {texts.drivers.shortNames[chain.slug] ?? chain.name}
            </span>
          </span>
        );
      })}
    </>
  );
}

const CHECK_KEYS = ['supply', 'bridge', 'continuity'] as const;

/** One row of the status table in enabled-chain order: the same cells as before. */
function StatusRows({ overview }: { overview: Overview }) {
  return (
    <>
      {overview.chains.map((chain, index) => {
        const status = overview.status.chains.find(
          (candidate) => candidate.chain === chain.slug,
        );
        if (status === undefined) return null;
        const summary = overview.reconciliation.chains.find(
          (candidate) => candidate.chain === chain.slug,
        );
        return (
          <tr
            key={chain.slug}
            data-chain={chain.slug}
            data-chain-index={index + 1}
            data-chain-state={status.state}
            data-quality={
              status.state === 'unreconciled'
                ? 'unreconciled'
                : status.state === 'no_data'
                  ? 'incomplete'
                  : status.state
            }
          >
            <th scope="row">
              <span className="dot" />
              {chain.name}
            </th>
            <td data-label={texts.status.columns.state}>
              {status.state === 'delayed'
                ? texts.tags.behind(
                    chain.name,
                    formatCount(status.lagHours),
                  )
                : texts.status.states[status.state]}
            </td>
            <td data-label={texts.status.columns.lastClosedDay}>
              {status.lastClosedDay === null
                ? texts.noData
                : formatShortDay(status.lastClosedDay)}
            </td>
            <td
              data-label={texts.status.columns.reconciliation}
              className="status-checks"
            >
              {status.reconciliation === null
                ? texts.noData
                : CHECK_KEYS.map((check, at) => (
                    <span
                      key={check}
                      data-check={status.reconciliation![check]}
                    >
                      {at > 0 ? ' · ' : ''}
                      {texts.status.checks[check]}{' '}
                      {texts.status.checkMarks[status.reconciliation![check]]}
                    </span>
                  ))}
            </td>
            <td data-label={texts.status.columns.lastRun}>
              {status.lastRun === null
                ? texts.noData
                : texts.status.run(
                    formatRunTime(status.lastRun.finishedAt),
                    status.lastRun.status,
                  )}
            </td>
            <td
              data-label={texts.status.columns.unreconciledDays}
              data-unreconciled={
                status.unreconciledDays.length > 0 ? 'true' : undefined
              }
            >
              {formatCount(summary?.mismatchedDays ?? null)}
              {status.unreconciledDays.length === 0 ? null : (
                <span className="sr">
                  {formatDays(status.unreconciledDays).join(', ')}
                </span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

/** One chain as a phone row: name and state, then the board's two meta lines. */
function StatusListItems({ overview }: { overview: Overview }) {
  return (
    <>
      {overview.chains.map((chain) => {
        const status = overview.status.chains.find(
          (candidate) => candidate.chain === chain.slug,
        );
        if (status === undefined) return null;
        const summary = overview.reconciliation.chains.find(
          (candidate) => candidate.chain === chain.slug,
        );
        const checks =
          status.reconciliation === null
            ? texts.noData
            : CHECK_KEYS.map(
                (check) =>
                  `${texts.status.checks[check]} ${texts.status.checkMarks[status.reconciliation![check]]}`,
              ).join(' · ');
        return (
          <li
            key={chain.slug}
            data-chain={chain.slug}
            data-chain-state={status.state}
            data-quality={
              status.state === 'unreconciled'
                ? 'unreconciled'
                : status.state === 'no_data'
                  ? 'incomplete'
                  : status.state
            }
          >
            <span className="sl-name">
              <span className="dot" />
              {chain.name}
            </span>
            <span className="sl-state">
              <span className={`sl-mark ${status.state}`} aria-hidden="true">
                {status.state === 'unreconciled'
                  ? texts.status.unreconciled
                  : texts.status.checkMarks.ok}
              </span>{' '}
              {status.state === 'delayed'
                ? texts.tags.behind(
                    chain.name,
                    formatCount(status.lagHours),
                  )
                : texts.status.states[status.state]}
            </span>
            <span className="sl-meta">
              {texts.status.closedLine(
                status.lastClosedDay === null
                  ? texts.noData
                  : formatShortDay(status.lastClosedDay),
                checks,
              )}
            </span>
            <span className="sl-meta">
              {texts.status.runLine(
                status.lastRun === null
                  ? texts.noData
                  : texts.status.run(
                      formatRunTime(status.lastRun.finishedAt),
                      status.lastRun.status,
                    ),
                summary === undefined
                  ? texts.noData
                  : texts.status.mismatchedShort(
                      formatCount(summary.mismatchedDays),
                    ),
              )}
            </span>
          </li>
        );
      })}
    </>
  );
}

/** The always-open Status section: server HTML, no disclosure, no JavaScript. */
export function Status({ overview }: { overview: Overview }) {
  return (
    <section
      className="block status"
      id="chain-status"
      data-block="status"
      aria-labelledby="h-chain-status"
    >
      <div className="sec-head">
        <h2 id="h-chain-status">
          {texts.status.title}{' '}
          <span className="dim">
            · {texts.status.asOf(formatDay(overview.asOf))}
          </span>
        </h2>
        <span className="sec-aside">
          {texts.header.stamp(
            formatCount(overview.reconciliation.reconciledChains),
            formatCount(overview.chains.length),
            formatCount(overview.reconciliation.all.mismatchedDays),
            formatCount(overview.reconciliation.all.closedDays),
          )}
        </span>
      </div>
      <div className="status-table">
        <table className="status" aria-label={texts.status.title}>
          <thead>
            <tr>
              {Object.values(texts.status.columns).map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <StatusRows overview={overview} />
          </tbody>
        </table>
      </div>
      <ul className="status-list" aria-label={texts.status.title}>
        <StatusListItems overview={overview} />
      </ul>
    </section>
  );
}
