import {
  type PageProps,
  disabledPeriods,
  historyDays,
  PERIODS,
} from '@app/view';
import { texts } from '../texts.ts';
import { formatCount, formatDay } from '../view.ts';
import { Drivers } from './Drivers.tsx';
import { Feed } from './Feed.tsx';
import { Header } from './Header.tsx';
import { Mark } from './Mark.tsx';
import { HowWeCount } from './Notes.tsx';
import { Records } from './Records.tsx';
import { ChainDots, Status } from './Status.tsx';
import { SupplyByChain } from './SupplyByChain.tsx';
import { HomeInteractions } from './client/HomeInteractions.tsx';

export function PageView({ model, demoState }: PageProps) {
  const overview = model.state === 'unavailable' ? null : model.overview;
  const date =
    overview?.asOf === null || overview?.asOf === undefined
      ? null
      : texts.asOf(formatDay(overview.asOf));
  const off = new Set(
    overview === null ? PERIODS : disabledPeriods(historyDays(overview)),
  );
  const delayed =
    overview?.status.chains.filter((status) => status.state === 'delayed') ??
    [];
  const flagged =
    overview?.status.chains.some((status) => status.state === 'unreconciled') ??
    false;
  return (
    <main className="page" data-page-state={model.state}>
      {model.state === 'unavailable' ? (
        <meta name="robots" content="noindex" />
      ) : null}
      <div className="wrap">
        {demoState === null ? null : (
          <p className="demo" data-demo-state={demoState}>
            {texts.demo(demoState)}
          </p>
        )}
        <header className="brand-row">
          <h1 className="wordmark">
            <Mark />
            {texts.productName}
          </h1>
          {overview === null ? null : (
            <p className="tagline">{texts.tagline}</p>
          )}
          {overview === null ? null : (
            <p className="through" data-date="brand">
              {date ?? texts.states.empty}
            </p>
          )}
          {model.state === 'data' ? (
            <span
              className={`brand-note ${flagged ? 'unrec' : ''}`}
              data-quality={flagged ? 'unreconciled' : 'ok'}
            >
              {texts.header.reconciled(
                formatCount(model.overview.reconciliation.reconciledChains),
                formatCount(model.overview.chains.length),
              )}{' '}
              {flagged ? texts.status.unreconciled : texts.status.checkMarks.ok}
            </span>
          ) : null}
          {delayed.map((status) => (
            <span
              key={status.chain}
              className="brand-note delayed"
              data-quality="delayed"
            >
              {texts.tags.behind(
                overview?.chains.find((chain) => chain.slug === status.chain)
                  ?.name ?? status.chain,
                formatCount(status.lagHours),
              )}
            </span>
          ))}
        </header>
        {model.state === 'unavailable' ? (
          <div className="state-box" role="alert">
            <h2>{texts.states.unavailable}</h2>
            <p>{texts.states.unavailableBody}</p>
            <a className="btn" href="/">
              {texts.states.reload}
            </a>
          </div>
        ) : null}
        {model.state === 'empty' ? (
          <section className="state-box" data-block="no-figures">
            <h2>{texts.states.empty}</h2>
            <p>{texts.states.emptyBody}</p>
            <div className="empty-dots">
              <ChainDots overview={model.overview} />
            </div>
          </section>
        ) : null}
        {model.state === 'data' ? (
          <>
            <div className="stamp-row">
              <p className="stamp">
                {texts.header.stamp(
                  formatCount(model.overview.reconciliation.reconciledChains),
                  formatCount(model.overview.chains.length),
                  formatCount(model.overview.reconciliation.all.mismatchedDays),
                  formatCount(model.overview.reconciliation.all.closedDays),
                )}
              </p>
              <Status overview={model.overview} />
            </div>
            <Header overview={model.overview} />
            <div className="period-group">
              <SupplyByChain overview={model.overview} />
              <Drivers overview={model.overview} />
            </div>
            <Feed overview={model.overview} />
            <Records overview={model.overview} />
            <HowWeCount />
            <div className="sticky" id="sticky-bar" hidden>
              <a
                className="wordmark"
                href="#hero"
                aria-label={texts.productName}
              >
                <Mark />
                <span>{texts.productName}</span>
              </a>
              <span className="through" data-date="sticky">
                {date}
              </span>
              <div
                className="seg"
                role="group"
                aria-label={texts.period.legend}
              >
                {PERIODS.map((period) => (
                  <button
                    key={period}
                    type="button"
                    data-sticky-period={period}
                    disabled={
                      off.has(period) || model.overview.views[period] === null
                    }
                    aria-pressed={period === '30d'}
                  >
                    {texts.period.options[period]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`sdot ${delayed.length > 0 ? 'delayed' : flagged ? 'unrec' : ''}`}
                data-status-link
                data-quality={
                  delayed.length > 0
                    ? 'delayed'
                    : flagged
                      ? 'unreconciled'
                      : 'ok'
                }
                aria-label={texts.status.title}
              />
            </div>
            <HomeInteractions />
          </>
        ) : null}
      </div>
    </main>
  );
}
