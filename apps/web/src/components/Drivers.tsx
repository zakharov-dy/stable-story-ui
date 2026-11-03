import type { Overview, Series } from '@app/contracts';
import {
  columnWidth,
  columnX,
  coordinate,
  diamondPath,
  fractionY,
  linePath,
  segments,
  symmetricFraction,
  unscale,
  type Frame,
  type TooltipColumn,
  chainInfo,
  type ChainInfo,
  type Chains,
  fromSeries,
  merge,
  PERIODS,
  driverColumns,
  driverDigits,
  driverExtent,
  driverScopes,
  flagRuns,
  type DriverColumns,
  type DriverKey,
  tooltipText,
  tooltipTitle,
} from '@app/view';
import {
  formatCount,
  formatDays,
  formatEnds,
  formatHistoryRange,
  formatRange,
  axisSigned,
  bucketLabel,
  runLabel,
  shortDay,
  driverTooltips,
} from '../view.ts';
import { texts } from '../texts.ts';
import { Chart, ColumnBands, type Tick } from './Chart.tsx';
import { QualityNote } from './QualityNote.tsx';

const FRAME = { width: 400, height: 200, left: 2, right: 2, top: 4, bottom: 4 } as const;
const HATCH = 4; // the period of the bridge hatch; the same number as --hatch-size in tokens.css (checked by a test)
const LEGEND = ['issuer_mint', 'bridge_in', 'issuer_burn', 'bridge_out', 'net'] as const satisfies readonly DriverKey[];

type Status = Overview['status']['chains'][number];

const slug = (value: string): string => value.replace(/[^A-Za-z0-9_-]/g, '-');

/**
 * The defs of one chart: the issuer gradients (opaque at the flow edge, 6 % toward zero) and the
 * bridge hatch. Ids carry the block, the chain, the role and the period, so the server and the
 * client agree and the three period copies never share one.
 */
const gradId = (chain: string, side: 'up' | 'down', period: string): string => `grad-drivers-${slug(chain)}-${side}-${period}`;
const hatchId = (chain: string, role: 'in' | 'out', period: string): string => `hatch-drivers-${slug(chain)}-${role}-${period}`;

function Defs({ chain, period }: { chain: string; period: string }) {
  return (
    <defs>
      {(['up', 'down'] as const).map((side) => (
        <linearGradient
          key={side}
          id={gradId(chain, side, period)}
          className={side === 'up' ? 'grad-up grad-fill' : 'grad-down grad-fill'}
          x1="0"
          y1={side === 'up' ? '0' : '1'}
          x2="0"
          y2={side === 'up' ? '1' : '0'}
        >
          <stop offset="0" stopOpacity={0.42} />
          <stop offset="1" stopOpacity={0.06} />
        </linearGradient>
      ))}
      {(['in', 'out'] as const).map((role) => (
        <pattern key={role} id={hatchId(chain, role, period)} width={HATCH} height={HATCH} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect className={`hatch-ink ${role}`} width={HATCH * 0.35} height={HATCH} fillOpacity={0.6} />
        </pattern>
      ))}
    </defs>
  );
}

function ChainDrivers({ chain, series, events, columns, digits, extent, chains, status, period, pos }: {
  chain: string;
  series: Series;
  events: readonly (number | null)[];
  columns: DriverColumns;
  digits: number;
  extent: bigint;
  chains: Chains;
  status: Status | undefined;
  period: string;
  /** The 1-based position in `overview.chains` (`0` = the All view): the CSS key of the chain switch. */
  pos: number;
}) {
  const info: ChainInfo = chain === 'all' ? { slug: 'all', name: texts.drivers.allChains, index: 0 } : chainInfo(chains, chain);
  const { buckets } = series;
  const frame: Frame = { ...FRAME, columns: buckets.length };
  const y = (value: bigint): number => fractionY(frame, symmetricFraction(value, extent));
  const zero = y(0n);
  const half = columnWidth(frame) / 2;
  const first = buckets[0];
  const last = buckets.at(-1);
  const lastIndex = buckets.length - 1;
  const known = columns.known;
  const runs = segments(buckets.length, (index) => known[index] === true);
  const gap = known.map((value) => !value);
  const gapRuns = flagRuns(gap);
  const emptyDays = columns.empty.flatMap((empty, index) => (empty ? [index] : []));
  const flagged = columns.unreconciled;
  const flaggedSet = new Set(flagged);
  const delayed = status?.state === 'delayed';
  const net = columns.values.net;
  const at = (list: readonly (bigint | null)[], index: number): bigint => list[index] ?? 0n;

  // A band between an edge curve and a baseline curve over one run of known days; a one-day run
  // spreads over the column width so it stays visible. No path ever spans a gap.
  const band = (edge: (index: number) => bigint, base: (index: number) => bigint, [from, to]: [number, number]): string => {
    const upper: string[] = [];
    const lower: string[] = [];
    for (let index = from; index <= to; index += 1) {
      const xs = from === to ? [columnX(frame, index) - half, columnX(frame, index) + half] : [columnX(frame, index)];
      const top = coordinate(y(edge(index)));
      const bottom = coordinate(y(base(index)));
      for (const x of xs) {
        upper.push(`${coordinate(x)} ${top}`);
        lower.push(`${coordinate(x)} ${bottom}`);
      }
    }
    return `M${[...upper, ...lower.reverse()].join('L')}Z`;
  };
  // The flow boundary of a band: the same points as the upper edge, without the baseline.
  const edge = (line: (index: number) => bigint, [from, to]: [number, number]): string => {
    const points: string[] = [];
    for (let index = from; index <= to; index += 1) {
      const xs = from === to ? [columnX(frame, index) - half, columnX(frame, index) + half] : [columnX(frame, index)];
      const top = coordinate(y(line(index)));
      for (const x of xs) points.push(`${coordinate(x)} ${top}`);
    }
    return `M${points.join('L')}`;
  };

  const issuer = (solid: DriverKey, bridge: DriverKey, side: 'up' | 'down', sign: 1n | -1n) => {
    const solidAt = (index: number): bigint => sign * at(columns.values[solid], index);
    const bridgeAt = (index: number): bigint => solidAt(index) + sign * at(columns.values[bridge], index);
    const hatch = hatchId(chain, side === 'up' ? 'in' : 'out', period);
    return runs.flatMap((run) => [
      <path key={`area-${solid}-${run[0]}`} className="issuer-area" data-flow={solid} d={band(solidAt, () => 0n, run)} fill={`url(#${gradId(chain, side, period)})`} />,
      <path key={`edge-${solid}-${run[0]}`} className="issuer-edge" data-flow={solid} d={edge(solidAt, run)} />,
      <path key={`area-${bridge}-${run[0]}`} className="bridge-area" data-flow={bridge} d={band(bridgeAt, solidAt, run)} fill={`url(#${hatch})`} />,
      <path key={`edge-${bridge}-${run[0]}`} className="bridge-edge" data-flow={bridge} d={edge(bridgeAt, run)} />,
    ]);
  };
  // The net line through the known points; a run that ends on an unreconciled last day splits at
  // its penultimate point, and the final segment alone is dashed. The dashed path is the only one
  // that draws the final segment; a flagged middle day only gets its diamond.
  const netPaths = (() => {
    const points = net.map((value, index) => (value === null || value === undefined ? null : { x: columnX(frame, index), y: y(value) }));
    const netRuns = segments(buckets.length, (index) => points[index] !== null);
    return netRuns.flatMap(([from, to]) => {
      const dashed = to === lastIndex && to > from && flaggedSet.has(to);
      if (!dashed) return [<path key={`net-${from}`} className="net-line" data-flow="net" d={linePath(points.slice(from, to + 1))} />];
      return [
        <path key={`net-${from}`} className="net-line" data-flow="net" d={linePath(points.slice(from, to))} />,
        <path key={`net-dash-${from}`} className="net-line net-dash" data-flow="net" d={linePath(points.slice(to - 1, to + 1))} />,
      ];
    });
  })();
  const lastNet = (() => {
    const value = net[lastIndex];
    return value === null || value === undefined ? null : { x: columnX(frame, lastIndex), y: y(value) };
  })();

  const tooltips: TooltipColumn[] = driverTooltips(series, digits, info.name, events);
  const columns_ = tooltips.length === buckets.length ? tooltips : undefined;
  const tips = buckets.map((bucket, index) => {
    const column = columns_?.[index];
    return column === undefined ? bucketLabel(bucket) : tooltipTitle(column);
  });
  const announcements = columns_?.map((column) => tooltipText(column));
  const markers = buckets.map((_bucket, index) => {
    const value = net[index];
    return value === null || value === undefined ? [] : [{ at: y(value) / frame.height, flow: 'net' as const }];
  });

  const ticks: Tick[] =
    extent === 0n
      ? [{ at: 0.5, label: '0' }]
      : [
          { at: 0, label: axisSigned(unscale(extent, digits)) },
          { at: 0.25, label: axisSigned(unscale(extent / 2n, digits)) },
          { at: 0.75, label: axisSigned(unscale(-extent / 2n, digits)) },
          { at: 1, label: axisSigned(unscale(-extent, digits)) },
        ];
  const grid = extent === 0n ? [] : [extent, extent / 2n, -extent / 2n, -extent].map((value) => coordinate(y(value)));
  const markAt = [
    { index: Math.round(lastIndex / 4), minor: true },
    { index: Math.round(lastIndex / 2), minor: false },
    { index: Math.round((3 * lastIndex) / 4), minor: true },
  ];
  const marks: Tick[] =
    buckets.length < 8
      ? []
      : markAt.flatMap(({ index, minor }) => {
          const bucket = buckets[index];
          return bucket === undefined ? [] : [{ at: (index + 0.5) / buckets.length, label: shortDay(bucket.end), minor }];
        });

  const lastValues = lastIndex < 0 ? '' : LEGEND.map((key) => {
    const raw = columns.values[key][lastIndex] ?? null;
    const signed = raw === null ? null : (key === 'issuer_burn' || key === 'bridge_out' ? unscale(-raw, digits) : unscale(raw, digits));
    return `${texts.flows[key]} ${signed === null ? texts.noData : axisSigned(signed)}`;
  }).join(', ');
  const label = texts.drivers.chart(info.name, axisSigned(unscale(extent, digits)), last ? texts.drivers.lastDay(bucketLabel(last), lastValues) : '', texts.resolution.steps[series.period] ?? series.period);
  const ends = first && last ? formatEnds(first.start, last.end) : null;
  const endsOf = (indices: readonly number[]): string =>
    formatDays(indices.flatMap((index) => { const bucket = buckets[index]; return bucket === undefined ? [] : [bucket.end]; })).join(', ');
  const unreconciledDays = series.period === 'day' ? endsOf(flagged) : texts.resolution.flagged;
  const emptyDayNames = series.period === 'day' ? endsOf(emptyDays) : emptyDays.map((index) => bucketLabel(buckets[index])).join(', ');
  const leading = gapRuns[0]?.[0] === 0 ? buckets[(gapRuns[0]?.[1] ?? 0) + 1] : undefined;

  return (
    <figure
      className="card mult"
      data-period={period}
      data-scope={chain}
      data-pos={pos}
      data-chain-index={info.index}
      data-scale={unscale(extent, digits)}
      data-delayed={delayed ? 'true' : undefined}
      data-unreconciled={flagged.length > 0 ? 'true' : undefined}
    >
      <figcaption className="head">
        <span className="chain">{info.name}</span>
        {flagged.length > 0 ? <span className="tag unrec">{texts.drivers.unreconciledTag(unreconciledDays)}</span> : null}
        {delayed ? (
          <span className="tag delayed">
            {status?.lagHours === null || status?.lagHours === undefined ? texts.status.states.delayed : texts.tags.behindShort(formatCount(status.lagHours))}
          </span>
        ) : null}
        {gapRuns.length > 0 ? <span className="tag nodata">{leading ? texts.drivers.fromTag(shortDay(leading.start)) : texts.tags.noData}</span> : null}
        {gapRuns.length === 0 && flagged.length === 0 && !delayed && first && last ? (
          <span className="caption">{formatRange(first.start, last.end)}</span>
        ) : null}
      </figcaption>
      <Chart
        frame={frame}
        tips={tips}
        tooltips={columns_}
        announcements={announcements}
        markers={markers}
        label={label}
        variant="drivers"
        axis={{
          top: ticks[0]?.label ?? '',
          bottom: ticks.at(-1)?.label ?? '',
          ticks,
          start: ends?.[0],
          end: ends?.[1],
          marks,
        }}
      >
        <Defs chain={chain} period={period} />
        {grid.map((at) => <line key={at} className="b-grid" x1={frame.left} x2={frame.width - frame.right} y1={at} y2={at} />)}
        <ColumnBands frame={frame} incomplete={buckets.map((bucket) => !bucket.complete)} missing={gap} />
        {issuer('issuer_mint', 'bridge_in', 'up', 1n)}
        {issuer('issuer_burn', 'bridge_out', 'down', -1n)}
        {emptyDays.map((index) => (
          <line
            key={index}
            className="b-zero0"
            data-empty-day="true"
            x1={coordinate(columnX(frame, index) - half)}
            x2={coordinate(columnX(frame, index) + half)}
            y1={coordinate(zero)}
            y2={coordinate(zero)}
          />
        ))}
        <line className="b-zero" x1={frame.left} x2={frame.width - frame.right} y1={coordinate(zero)} y2={coordinate(zero)} />
        {netPaths}
        {lastNet ? <circle className="b-netdot" cx={coordinate(lastNet.x)} cy={coordinate(lastNet.y)} r={3.5} /> : null}
        {flagged.map((index) => {
          const value = net[index];
          const point = value === null || value === undefined ? null : { x: columnX(frame, index), y: y(value) };
          return <path key={index} className="chart-point" data-unreconciled="true" d={diamondPath(columnX(frame, index), point ? point.y : zero, 5)} />;
        })}
      </Chart>
      {gapRuns.length + emptyDays.length + flagged.length === 0 ? null : (
        <p className="mnote">
          {gapRuns.map((run) => <span key={`gap-${run[0]}`} className="nd">{texts.drivers.gapNote(runLabel(buckets, run))}</span>)}
          {flagged.length > 0 ? <span className="ur">{series.period === 'day' ? texts.drivers.unreconciledNote(unreconciledDays) : texts.resolution.flagged}</span> : null}
          {emptyDays.length > 0 ? <span className="zr">{texts.drivers.emptyNote(emptyDayNames)}</span> : null}
        </p>
      )}
    </figure>
  );
}

/**
 * Chart 4: one chart per view (All chains, then every chain in `overview.chains` order), each on
 * its own scale, for every period. One section holds the whole 3-periods × all-views matrix;
 * one chain radio group and the page-wide period switch combine through CSS `:has` on
 * `.period-group`, so the checked chain survives a period change and back. The server renders
 * every combination; without JavaScript the radios switch views with no fetch.
 */
export function Drivers({ overview, block = 'drivers', headingId = 'h-drivers' }: {
  overview: Overview;
  /**
   * The block marker for the page checks. The one section always carries the canonical
   * `drivers`; hidden copies no longer exist.
   */
  block?: string | null;
  /** The heading id, single for the one section, so no `id` is duplicated. */
  headingId?: string;
}) {
  const { chains } = overview;
  const views = [
    { scope: 'all', pos: 0, name: texts.drivers.allChains },
    ...chains.map((chain, index) => ({ scope: chain.slug, pos: index + 1, name: chain.name })),
  ];
  const periods = PERIODS.map((period) => {
    const drivers = driverScopes(overview, period);
    const byScope = new Map(drivers.map((driver) => [driver.scope, driver] as const));
    const cards = views.flatMap((view) => {
      const driver = byScope.get(view.scope);
      if (driver === undefined) return [];
      const digits = driverDigits(driver.series);
      const columns = driverColumns(driver.series, digits, driver.events);
      return [{ view, driver, digits, columns, extent: driverExtent(columns) }];
    });
    const summary = merge(drivers.map((driver) => fromSeries(driver.series)));
    const first = drivers[0]?.series.buckets[0];
    const last = drivers[0]?.series.buckets.at(-1);
    // The whole history carries the year once, like section 03; the windows do not.
    const range = first && last ? (period === 'all' ? formatHistoryRange(first.start, last.end) : formatRange(first.start, last.end)) : texts.noData;
    // The scale note names the shaded incomplete bucket only when the period really has one.
    const incomplete = drivers.some((driver) => driver.series.buckets.some((bucket) => !bucket.complete));
    return { period, cards, summary, range, hasEmptyDay: cards.some((card) => card.columns.empty.includes(true)), incomplete, step: texts.resolution.units[overview.views[period]?.period ?? 'day'] ?? 'day' };
  });
  const statusOf = (scope: string): Status | undefined =>
    scope === 'all' ? undefined : overview.status.chains.find((candidate) => candidate.chain === scope);
  const lagOf = (status: Status | undefined): string | null => {
    if (status?.state !== 'delayed') return null;
    return status.lagHours === null || status.lagHours === undefined
      ? texts.status.states.delayed
      : texts.tags.behindShort(formatCount(status.lagHours));
  };
  return (
    <section className="sec" data-block={block ?? undefined} aria-labelledby={headingId}>
      <div className="sec-h">
        <div>
          <span className="label"><span className="ix">{texts.section.label(4)}</span>{texts.drivers.title}</span>
          <h2 id={headingId}>
            {periods.map(({ period }) => <span key={period} data-ph={period}>{texts.drivers.headline(period, texts.resolution.units[overview.views[period]?.period ?? 'day'])}</span>)}
          </h2>
        </div>
        <p>{periods.map(({ period, range }) => <span key={period} data-ph={period}>{texts.drivers.caption(range, texts.resolution.units[overview.views[period]?.period ?? 'day'])}</span>)}</p>
      </div>
      <div className="dtoolbar">
        <fieldset className="seg chains">
          <legend>{texts.drivers.chain}</legend>
          {views.map((view) => {
            const lag = lagOf(statusOf(view.scope));
            return (
              <label key={view.scope} data-chain-index={view.pos === 0 ? undefined : view.pos}>
                <input type="radio" name="chain" value={view.scope} data-pos={view.pos} defaultChecked={view.pos === 0} />
                <span>{view.pos === 0 ? null : <i />}{view.name}{lag === null ? null : <b className="dl" title={lag}><span className="vh">{lag}</span></b>}</span>
              </label>
            );
          })}
        </fieldset>
        <a className="pecho" href="#period">{texts.drivers.echoBefore}{' '}{PERIODS.map((period) => <b key={period} data-ph={period}>{texts.period.options[period]}</b>)}{' '}<span>{texts.drivers.echoAfter}</span></a>
      </div>
      {periods.map(({ period, summary, step }) => (
        <div key={period} className="qwrap" data-ph={period}>
          <QualityNote summary={summary} points step={step} />
        </div>
      ))}
      <ul className="legend" aria-label={texts.drivers.legend}>
        {LEGEND.map((key) => <li key={key} data-flow={key}>{texts.flows[key]}</li>)}
        {periods.map(({ period, hasEmptyDay, step }) => (hasEmptyDay ? <li key={period} data-ph={period} data-flow="zero">{texts.drivers.emptyDay(step)}</li> : null))}
      </ul>
      <div className="views">
        {periods.flatMap(({ period, cards }) => cards.map(({ view, driver, digits, columns, extent }) => (
          <ChainDrivers
            key={`${period}-${view.scope}`}
            chain={view.scope}
            series={driver.series}
            events={driver.events}
            columns={columns}
            digits={digits}
            extent={extent}
            chains={chains}
            status={statusOf(view.scope)}
            period={period}
            pos={view.pos}
          />
        )))}
      </div>
      <p className="caption vscale">
        {periods.flatMap(({ period, cards, incomplete }) => cards.map(({ view }) => (
          <span key={`${period}-${view.scope}`} data-ph={period} data-pos={view.pos}>
            {texts.drivers.scaleView(view.scope === 'all' ? texts.drivers.allScale : view.name, texts.resolution.units[overview.views[period]?.period ?? 'day'], incomplete)}
          </span>
        )))}
      </p>
    </section>
  );
}
