import type { Overview, Split } from '@app/contracts';
import { coordinate, fraction, scale, chainInfo, type PeriodId, fromQuality, merge, qualityAttribute } from '@app/view';
import { formatCompact, formatCount, formatDays, formatPercent, formatRange, naReason } from '../view.ts';
import { texts } from '../texts.ts';
import { QualityNote } from './QualityNote.tsx';
import { SectionHeading } from './SectionHeading.tsx';

type Side = 'in' | 'out';
type Basis = 'volume' | 'count';

const CELLS: readonly (readonly [Side, Basis])[] = [['in', 'volume'], ['in', 'count'], ['out', 'volume'], ['out', 'count']];

/** A 0–100 % bar: the issuer part solid, the bridge part hatched. An unknown share is an empty bar. */
function ShareBar({ share, side }: { share: string | null; side: Side }) {
  const [value, hundred] = scale([share, '100']).values;
  if (value === null || value === undefined || hundred === null || hundred === undefined) {
    return <div className="share-bar empty" role="img" aria-label={texts.issuerVsBridge.shareUnknown} />;
  }
  const issuer = fraction(value, 0n, hundred) * 100;
  return (
    <div className="share-bar" role="img" aria-label={texts.issuerVsBridge.shareOf(formatPercent(share))}>
      {issuer > 0 ? <span className={`iss ${side}`} style={{ width: `${coordinate(issuer)}%` }} /> : null}
      {issuer < 100 ? <span className={`brg ${side}`} style={{ width: `${coordinate(100 - issuer)}%` }} /> : null}
    </div>
  );
}

function Parts({ basis, split }: { basis: Basis; split: Split }) {
  const text = texts.issuerVsBridge;
  const [issuer, bridge] =
    basis === 'volume'
      ? [formatCompact(split.volume.issuer), formatCompact(split.volume.bridge)]
      : [formatCount(split.count.issuer), formatCount(split.count.bridge)];
  return (
    <span className="words">
      {text.issuer} <b>{issuer}</b> {text.separator} {text.bridge} <b>{bridge}</b>
      {basis === 'count' ? ` ${text.operations}` : null}
    </span>
  );
}

function Cell({ side, basis, split }: { side: Side; basis: Basis; split: Split }) {
  const text = texts.issuerVsBridge;
  const share = split[basis].issuerShare;
  const days = split.quality.unreconciledDays;
  return (
    <div className="mx-cell" data-side={side} data-basis={basis} data-quality={qualityAttribute(fromQuality(split.quality))}>
      <span className="k">{text.cellKey(text[side], text[basis])}</span>
      <div className="top">
        {share === null ? (
          <span className="pct na">{texts.na.label}</span>
        ) : (
          <span className="pct">
            {formatPercent(share)}
            <small>{text.issuer}</small>
          </span>
        )}
        {days.length === 0 ? null : (
          <span className="ur" data-flag="unreconciled">
            {text.flagDays(formatDays(days).join(', '))}
          </span>
        )}
      </div>
      <ShareBar share={share} side={side} />
      {share === null ? <span className="words na-why">{naReason(basis, side, split.quality)}</span> : <Parts basis={basis} split={split} />}
    </div>
  );
}

/**
 * Chart 4: issuer share among inflows and outflows, by volume and by operations, for all chains and
 * each chain. A matrix at wide widths, one card per scope on a phone. A share the API cannot
 * state is "n/a" with its reason and an empty bar, never 0. One copy per period of the page-wide
 * switch; PageView always passes an explicit period for each entry it renders.
 */
export function IssuerVsBridge({ overview, period = '30d', block = 'issuer-vs-bridge', headingId = 'h-issuer-vs-bridge' }: {
  overview: Overview;
  /**
   * The window this copy shows. The internal default is `30d` so a direct render is the 30-day
   * view exactly as before; PageView always passes an explicit period for each of its copies.
   */
  period?: PeriodId;
  /**
   * The block marker for the page checks. Only the visible default copy carries the canonical
   * `issuer-vs-bridge`: hidden copies pass null and render no `data-block` at all.
   */
  block?: string | null;
  /** The heading id; hidden copies pass a suffixed one so no `id` is duplicated. */
  headingId?: string;
}) {
  const entry = overview.views[period];
  const rows = entry?.issuerVsBridge ?? [];
  const text = texts.issuerVsBridge;
  const summary = merge(rows.flatMap((row) => [fromQuality(row.in.quality), fromQuality(row.out.quality)]));
  const range = entry === null ? null : formatRange(entry.from, entry.to);
  return (
    <section className="sec" data-block={block ?? undefined} data-period={period} data-quality={qualityAttribute(summary)} aria-labelledby={headingId}>
      <SectionHeading index={5} label={text.title} title={text.headline} caption={text.caption(range)} id={headingId} />
      <QualityNote summary={summary} />
      <div className="mx">
        <div className="mx-row grp" aria-hidden="true">
          <span />
          <span className="g">{text.groupIn}</span>
          <span className="g">{text.groupOut}</span>
        </div>
        <div className="mx-row sub" aria-hidden="true">
          <span>{text.scope}</span>
          {CELLS.map(([side, basis]) => <span key={`${side}-${basis}`}>{text[basis]}</span>)}
        </div>
        {rows.map((row) => {
          const info = row.scope === 'all' ? null : chainInfo(overview.chains, row.scope);
          const flagged = row.in.quality.unreconciledDays.length + row.out.quality.unreconciledDays.length > 0;
          return (
            <div
              key={row.scope}
              className="mx-row"
              data-scope={row.scope}
              data-chain-index={info === null || info.index === 0 ? undefined : info.index}
              data-unreconciled={flagged ? 'true' : undefined}
            >
              <h3 className={info === null ? 'mx-scope all' : 'mx-scope'}>{info === null ? text.all : info.name}</h3>
              {CELLS.map(([side, basis]) => <Cell key={`${side}-${basis}`} side={side} basis={basis} split={row[side]} />)}
            </div>
          );
        })}
      </div>
    </section>
  );
}
