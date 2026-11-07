import type { PageProps, PeriodId } from '@app/view';
import { texts } from '../texts.ts';
import {
  defaultPeriod,
  formatCount,
  formatDay,
  offPeriods,
  PERIOD_ORDER,
} from '../view.ts';
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
  const off = new Set<PeriodId>(
    overview === null ? [] : offPeriods(overview),
  );
  const delayed =
    overview?.status.chains.filter((status) => status.state === 'delayed') ??
    [];
  const flagged =
    overview?.status.chains.some((status) => status.state === 'unreconciled') ??
    false;
  const initial = overview === null ? '30d' : defaultPeriod(overview);
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
            <span className="sep" aria-hidden="true">
              ·
            </span>
          ) : null}
          {model.state === 'data' && delayed.length > 0
            ? delayed.map((status) => (
                <a
                  key={status.chain}
                  className="brand-note rec-link delayed"
                  href="#chain-status"
                  data-quality="delayed"
                >
                  {texts.tags.behind(
                    overview?.chains.find(
                      (chain) => chain.slug === status.chain,
                    )?.name ?? status.chain,
                    formatCount(status.lagHours),
                  )}
                </a>
              ))
            : model.state === 'data'
              ? (
                  <a
                    className="brand-note rec-link"
                    href="#chain-status"
                    data-quality={flagged ? 'unreconciled' : 'ok'}
                  >
                    {texts.header.reconciled(
                      formatCount(
                        model.overview.reconciliation.reconciledChains,
                      ),
                      formatCount(model.overview.chains.length),
                    )}{' '}
                    <span className={flagged ? 'unrec' : 'ok'}>
                      {flagged
                        ? texts.status.unreconciled
                        : texts.status.checkMarks.ok}
                    </span>
                  </a>
                )
              : null}
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
            <Header overview={model.overview} />
            <div className="period-group">
              <SupplyByChain overview={model.overview} />
              <Drivers overview={model.overview} />
            </div>
            <Feed overview={model.overview} />
            <Records overview={model.overview} />
            <Status overview={model.overview} />
            <HowWeCount />
            <div className="sticky" id="sticky-bar" hidden>
              <div className="sticky-in">
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
                  {PERIOD_ORDER.map((period) => (
                    <button
                      key={period}
                      type="button"
                      data-sticky-period={period}
                      disabled={
                        off.has(period) ||
                        model.overview.views[period] === null
                      }
                      aria-pressed={period === initial}
                    >
                      {texts.period.options[period]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <HomeInteractions />
          </>
        ) : null}
      </div>
    </main>
  );
}
