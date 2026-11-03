import { texts } from '../texts.ts';
import { type PageProps, historyDays } from '@app/view';
import { DayEquation } from './DayEquation.tsx';
import { Drivers } from './Drivers.tsx';
import { Feed } from './Feed.tsx';
import { Header } from './Header.tsx';
import { IssuerVsBridge } from './IssuerVsBridge.tsx';
import { Mark } from './Mark.tsx';
import { Coverage, Disclaimer, HowWeCount } from './Notes.tsx';
import { PeriodSwitch } from './PeriodSwitch.tsx';
import { Records } from './Records.tsx';
import { Status } from './Status.tsx';
import { SupplyByChain } from './SupplyByChain.tsx';

/**
 * The whole page for one overview response: `data` — all blocks; `empty` (200 with
 * asOf: null) — the chains, their status and How we count, no figures; `unavailable` (an ApiError) —
 * a message without any figures, charts or status. Mock data is labelled as demo data.
 */
export function PageView({ model, demoState }: PageProps) {
  const overview = model.state === 'unavailable' ? null : model.overview;
  return (
    <main className="page" data-page-state={model.state}>
      {/* An outage page is not indexed; React hoists the meta into <head>. */}
      {model.state === 'unavailable' ? <meta name="robots" content="noindex" /> : null}
      <div className="wrap">
        {demoState === null ? null : (
          <div className="demo-bar">
            <p className="demo" data-demo-state={demoState}>{texts.demo(demoState)}</p>
          </div>
        )}
        <header className="topbar">
          <div className="brand">
            <h1 className="wordmark">
              <Mark />
              {texts.productName}
            </h1>
            <p className="tagline">{texts.tagline}</p>
          </div>
          {model.state === 'unavailable' ? null : <p className="cadence">{texts.cadence}</p>}
        </header>

        {model.state === 'unavailable' ? (
          <div className="state-msg" role="alert">
            <span className="label"><span className="ix">{texts.states.mark}</span>{texts.states.unavailableLabel}</span>
            <h2>{texts.states.unavailable}</h2>
            <p>{texts.states.unavailableBody}</p>
          </div>
        ) : null}
        {model.state === 'empty' ? (
          <section className="ab-header" data-block="no-figures">
            <div className="state-msg">
              <span className="label"><span className="ix">{texts.section.label(1)}</span>{texts.header.label}</span>
              <Coverage overview={model.overview} />
              <h2>{texts.states.empty}</h2>
              <p>{texts.states.emptyBody}</p>
            </div>
          </section>
        ) : null}

        {model.state === 'data' ? (
          <>
            <Header overview={model.overview} />
            <DayEquation overview={model.overview} />
            <div className="period-group">
              <PeriodSwitch days={historyDays(model.overview)} />
              <SupplyByChain overview={model.overview} period="30d" />
              <SupplyByChain overview={model.overview} period="90d" block={null} headingId="h-supply-by-chain-90d" />
              <SupplyByChain overview={model.overview} period="all" block={null} headingId="h-supply-by-chain-all" />
              <Drivers overview={model.overview} />
              {model.overview.views['30d'] !== null ? (
                <IssuerVsBridge overview={model.overview} period="30d" />
              ) : null}
              {model.overview.views['90d'] !== null ? (
                <IssuerVsBridge overview={model.overview} period="90d" block={null} headingId="h-issuer-vs-bridge-90d" />
              ) : null}
              {model.overview.views['all'] !== null ? (
                <IssuerVsBridge overview={model.overview} period="all" block={null} headingId="h-issuer-vs-bridge-all" />
              ) : null}
            </div>
            <Feed overview={model.overview} />
            <Records overview={model.overview} />
          </>
        ) : null}
        {overview === null ? null : <Status overview={overview} />}
        <HowWeCount overview={overview} />
        <Disclaimer />
      </div>
    </main>
  );
}
