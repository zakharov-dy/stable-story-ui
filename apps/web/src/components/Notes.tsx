import type { Overview } from '@app/contracts';
import { formatDay } from '../view.ts';
import { texts } from '../texts.ts';
import { Mark } from './Mark.tsx';

/**
 * How we count, a numbered list. The networks line comes from the overview: with a common history
 * start as is, for an empty page (asOf: null) the variant without one; an unavailable page has no
 * overview and no such line.
 */
export function HowWeCount({ overview }: { overview: Overview | null }) {
  const items: string[] = [texts.howWeCount.tracked, texts.howWeCount.issuer, texts.howWeCount.reconciliation, texts.howWeCount.aggregators];
  if (overview !== null) {
    const since = overview.asOf === null || overview.historyStart === null ? null : formatDay(overview.historyStart);
    items.push(texts.howWeCount.coverage(overview.chains.map((chain) => chain.name), since));
  }
  return (
    <section className="sec" data-block="how-we-count" aria-labelledby="h-how">
      <div className="hwc">
        <div>
          <span className="label"><span className="ix">{texts.howWeCount.marker}</span>{texts.howWeCount.label}</span>
          <h2 id="h-how">{texts.howWeCount.title}</h2>
        </div>
        <ol>
          {items.map((item, index) => (
            <li key={item}>
              <span className="n" aria-hidden="true">{texts.howWeCount.numbers[index] ?? ''}</span>
              <p>{item}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Disclaimer() {
  return (
    <footer className="disclaimer" data-block="disclaimer" aria-label={texts.disclaimer.title}>
      <span className="wordmark">
        <Mark />
        {texts.productName}
      </span>
      <p>{texts.disclaimer.body}</p>
    </footer>
  );
}

/** The coverage caption, from overview.chains: never a hard-coded chain count. */
export function Coverage({ overview }: { overview: Overview }) {
  const asset = texts.assetNames[overview.asset] ?? overview.asset.toUpperCase();
  return <p className="coverage">{texts.coverage(asset, overview.chains.map((chain) => chain.name))}</p>;
}
