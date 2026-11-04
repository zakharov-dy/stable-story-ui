import type { Overview } from '@app/contracts';
import { texts } from '../texts.ts';
import {
  formatCount,
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

/** Status belongs to the chain-dot disclosure, in enabled-chain order. */
export function Status({ overview }: { overview: Overview }) {
  return (
    <details className="chain-status" id="chain-status" data-block="status">
      <summary aria-label={texts.status.title}>
        <ChainDots overview={overview} />
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="status-pop">
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
                      : (['supply', 'bridge', 'continuity'] as const).map(
                          (check) => (
                            <span
                              key={check}
                              data-check={status.reconciliation![check]}
                            >
                              {texts.status.checks[check]}{' '}
                              {
                                texts.status.checkMarks[
                                  status.reconciliation![check]
                                ]
                              }
                            </span>
                          ),
                        )}
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
          </tbody>
        </table>
      </div>
    </details>
  );
}
