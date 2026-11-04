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
  qualityAttribute,
  PERIODS,
  driverColumns,
  driverDigits,
  driverExtent,
  type DriverKey,
  type DriverColumns,
  tooltipText,
  tooltipTitle,
} from '@app/view';
import {
  formatCount,
  formatEnds,
  formatRange,
  formatMonth,
  axisSigned,
  bucketLabel,
  driverTooltips,
} from '../view.ts';
import { texts } from '../texts.ts';
import { Chart, ColumnBands, type Tick } from './Chart.tsx';
import { formatCompact, formatPercent } from '../view.ts';
import { dateTicks } from './SupplyByChain.tsx';

const FRAME = {
  width: 400,
  height: 260,
  left: 2,
  right: 2,
  top: 4,
  bottom: 4,
} as const;
const HATCH = 4; // the period of the bridge hatch; the same number as --hatch-size in tokens.css (checked by a test)

type Status = Overview['status']['chains'][number];

const slug = (value: string): string => value.replace(/[^A-Za-z0-9_-]/g, '-');

/**
 * The bridge hatch definitions of one chart. Ids carry the block, the chain, the role and the period, so the server and the
 * client agree and the three period copies never share one.
 */
const hatchId = (chain: string, role: 'in' | 'out', period: string): string =>
  `hatch-drivers-${slug(chain)}-${role}-${period}`;

function Defs({ chain, period }: { chain: string; period: string }) {
  return (
    <defs>
      {(['in', 'out'] as const).map((role) => (
        <pattern
          key={role}
          id={hatchId(chain, role, period)}
          width={HATCH}
          height={HATCH}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect
            className={`hatch-ink ${role}`}
            width={HATCH * 0.35}
            height={HATCH}
            fillOpacity={0.6}
          />
        </pattern>
      ))}
    </defs>
  );
}

/** Round the rendering domain to the boards' 1, 2, 4, 8 decade steps. */
export function flowBound(extent: bigint): bigint {
  if (extent <= 0n) return 0n;
  const decade = 10n ** BigInt(extent.toString().length - 1);
  return [1n, 2n, 4n, 8n, 10n]
    .map((step) => step * decade)
    .find((bound) => bound >= extent)!;
}

function ChainDrivers({
  chain,
  series,
  events,
  columns,
  digits,
  extent,
  chains,
  status,
  period,
  pos,
}: {
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
  const info: ChainInfo =
    chain === 'all'
      ? { slug: 'all', name: texts.drivers.allChains, index: 0 }
      : chainInfo(chains, chain);
  const { buckets } = series;
  const frame: Frame = { ...FRAME, columns: buckets.length };
  const y = (value: bigint): number =>
    fractionY(frame, symmetricFraction(value, extent));
  const zero = y(0n);
  const half = columnWidth(frame) / 2;
  const first = buckets[0];
  const last = buckets.at(-1);
  const lastIndex = buckets.length - 1;
  const known = columns.known;
  const runs = segments(buckets.length, (index) => known[index] === true);
  const gap = known.map((value) => !value);
  const emptyDays = columns.empty.flatMap((empty, index) =>
    empty ? [index] : [],
  );
  const flagged = columns.unreconciled;
  const flaggedSet = new Set(flagged);
  const delayed = status?.state === 'delayed';
  const net = columns.values.net;
  const at = (list: readonly (bigint | null)[], index: number): bigint =>
    list[index] ?? 0n;

  // A band between an edge curve and a baseline curve over one run of known days; a one-day run
  // spreads over the column width so it stays visible. No path ever spans a gap.
  const band = (
    edge: (index: number) => bigint,
    base: (index: number) => bigint,
    [from, to]: [number, number],
  ): string => {
    const upper: string[] = [];
    const lower: string[] = [];
    for (let index = from; index <= to; index += 1) {
      const xs =
        from === to
          ? [columnX(frame, index) - half, columnX(frame, index) + half]
          : [columnX(frame, index)];
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
  const edge = (
    line: (index: number) => bigint,
    [from, to]: [number, number],
  ): string => {
    const points: string[] = [];
    for (let index = from; index <= to; index += 1) {
      const xs =
        from === to
          ? [columnX(frame, index) - half, columnX(frame, index) + half]
          : [columnX(frame, index)];
      const top = coordinate(y(line(index)));
      for (const x of xs) points.push(`${coordinate(x)} ${top}`);
    }
    return `M${points.join('L')}`;
  };

  const issuer = (
    solid: DriverKey,
    bridge: DriverKey,
    side: 'up' | 'down',
    sign: 1n | -1n,
  ) => {
    const solidAt = (index: number): bigint =>
      sign * at(columns.values[solid], index);
    const bridgeAt = (index: number): bigint =>
      solidAt(index) + sign * at(columns.values[bridge], index);
    const hatch = hatchId(chain, side === 'up' ? 'in' : 'out', period);
    return runs.flatMap((run) => [
      <path
        key={`area-${solid}-${run[0]}`}
        className="issuer-area"
        data-flow={solid}
        d={band(solidAt, () => 0n, run)}
      />,
      <path
        key={`edge-${solid}-${run[0]}`}
        className="issuer-edge"
        data-flow={solid}
        d={edge(solidAt, run)}
      />,
      <path
        key={`area-${bridge}-${run[0]}`}
        className="bridge-area"
        data-flow={bridge}
        d={band(bridgeAt, solidAt, run)}
        fill={`url(#${hatch})`}
      />,
      <path
        key={`edge-${bridge}-${run[0]}`}
        className="bridge-edge"
        data-flow={bridge}
        d={edge(bridgeAt, run)}
      />,
    ]);
  };
  // The net line through the known points; a run that ends on an unreconciled last day splits at
  // its penultimate point, and the final segment alone is dashed. The dashed path is the only one
  // that draws the final segment; a flagged middle day only gets its diamond.
  const netPaths = (() => {
    const points = net.map((value, index) =>
      value === null || value === undefined
        ? null
        : { x: columnX(frame, index), y: y(value) },
    );
    const netRuns = segments(buckets.length, (index) => points[index] !== null);
    return netRuns.flatMap(([from, to]) => {
      const dashed = to === lastIndex && to > from && flaggedSet.has(to);
      if (!dashed)
        return [
          <path
            key={`net-${from}`}
            className="net-line"
            data-flow="net"
            d={linePath(points.slice(from, to + 1))}
          />,
        ];
      return [
        <path
          key={`net-${from}`}
          className="net-line"
          data-flow="net"
          d={linePath(points.slice(from, to))}
        />,
        <path
          key={`net-dash-${from}`}
          className="net-line net-dash"
          data-flow="net"
          d={linePath(points.slice(to - 1, to + 1))}
        />,
      ];
    });
  })();
  const lastNet = (() => {
    const value = net[lastIndex];
    return value === null || value === undefined
      ? null
      : { x: columnX(frame, lastIndex), y: y(value) };
  })();

  const tooltips: TooltipColumn[] = driverTooltips(
    series,
    digits,
    info.name,
    events,
  );
  const columns_ = tooltips.length === buckets.length ? tooltips : undefined;
  const tips = buckets.map((bucket, index) => {
    const column = columns_?.[index];
    return column === undefined ? bucketLabel(bucket) : tooltipTitle(column);
  });
  const announcements = columns_?.map((column) => tooltipText(column));
  const markers = buckets.map((_bucket, index) => {
    const value = net[index];
    return value === null || value === undefined
      ? []
      : [{ at: y(value) / frame.height, flow: 'net' as const }];
  });

  const ticks: Tick[] =
    extent === 0n
      ? [{ at: 0.5, label: texts.axis.zero }]
      : [
          { at: 0, label: axisSigned(unscale(extent, digits)) },
          { at: 0.25, label: axisSigned(unscale(extent / 2n, digits)) },
          { at: 0.75, label: axisSigned(unscale(-extent / 2n, digits)) },
          { at: 1, label: axisSigned(unscale(-extent, digits)) },
        ];
  const grid =
    extent === 0n
      ? []
      : [extent, extent / 2n, -extent / 2n, -extent].map((value) =>
          coordinate(y(value)),
        );
  const label = texts.drivers.chart(
    info.name,
    texts.resolution.steps[series.period] ?? series.period,
  );
  const ends =
    first && last
      ? series.period === 'month'
        ? [formatMonth(first.end), formatMonth(last.end)]
        : formatEnds(first.end, last.end)
      : null;

  return (
    <figure
      className="flow-plot"
      data-period={period}
      data-quality={qualityAttribute(fromSeries(series))}
      data-scope={chain}
      data-pos={pos}
      data-chain-index={info.index}
      data-scale={unscale(extent, digits)}
      data-delayed={delayed ? 'true' : undefined}
      data-unreconciled={flagged.length > 0 ? 'true' : undefined}
    >
      <Chart
        frame={frame}
        tips={tips}
        tooltips={columns_}
        announcements={announcements}
        markers={markers}
        label={label}
        variant="drivers"
        stretch
        axis={{
          top: ticks[0]?.label ?? '',
          bottom: ticks.at(-1)?.label ?? '',
          ticks,
          start: ends?.[0],
          end: ends?.[1],
          marks: dateTicks(series),
        }}
      >
        <Defs chain={chain} period={period} />
        {grid.map((at) => (
          <line
            key={at}
            className="b-grid"
            x1={frame.left}
            x2={frame.width - frame.right}
            y1={at}
            y2={at}
          />
        ))}
        <ColumnBands frame={frame} missing={gap} />
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
        <line
          className="b-zero"
          x1={frame.left}
          x2={frame.width - frame.right}
          y1={coordinate(zero)}
          y2={coordinate(zero)}
        />
        {netPaths}
        {lastNet ? (
          <circle
            className="b-netdot"
            cx={coordinate(lastNet.x)}
            cy={coordinate(lastNet.y)}
            r={3.5}
          />
        ) : null}
        {flagged.map((index) => {
          const value = net[index];
          const point =
            value === null || value === undefined
              ? null
              : { x: columnX(frame, index), y: y(value) };
          return (
            <path
              key={index}
              className="chart-point"
              data-unreconciled="true"
              d={diamondPath(columnX(frame, index), point ? point.y : zero, 5)}
            />
          );
        })}
      </Chart>
    </figure>
  );
}

/** Native scope radios and CSS show the selected chart at the server's selected resolution. */
export function Drivers({ overview }: { overview: Overview }) {
  const scopes = [{ slug: 'all', name: texts.drivers.all }, ...overview.chains];
  return (
    <section
      className="block flows"
      data-block="drivers"
      aria-labelledby="h-drivers"
    >
      <div className="sec-head">
        <h2 id="h-drivers">
          {texts.drivers.title}{' '}
          {PERIODS.map((period) => {
            const view = overview.views[period];
            return view === null ? null : (
              <span className="dim" key={period} data-period={period}>
                · {formatRange(view.from, view.to)}
              </span>
            );
          })}
        </h2>
        {PERIODS.map((period) => {
          const split = overview.views[period]?.issuerVsBridge.find(
            (row) => row.scope === 'all',
          );
          return split === undefined ? null : (
            <p className="sec-aside" key={period} data-period={period}>
              {texts.drivers.shares(
                formatPercent(split.in.volume.issuerShare, { places: 0 }),
                formatPercent(split.out.volume.issuerShare, { places: 0 }),
              )}
            </p>
          );
        })}
      </div>
      <p className="sub">
        {texts.drivers.week(
          formatCompact(overview.header.issuerMinted7d.value),
          formatCompact(overview.header.issuerBurned7d.value),
        )}
      </p>
      <div
        className="scope-choices"
        role="group"
        aria-label={texts.supplyByChain.chain}
      >
        {scopes.map((scope, index) => {
          const status = overview.status.chains.find(
            (candidate) => candidate.chain === scope.slug,
          );
          return (
            <div key={scope.slug} className="scope-option">
              <label
                className="chip"
                data-chain-index={index === 0 ? undefined : index}
              >
                <input
                  type="radio"
                  name="chain"
                  value={scope.slug}
                  defaultChecked={index === 0}
                />
                {index === 0 ? null : (
                  <span className={`dot ${status?.state ?? ''}`} />
                )}
                {texts.drivers.shortNames[scope.slug] ?? scope.name}
                {status?.state === 'delayed' ? (
                  <span className="sr">
                    {texts.tags.behindShort(formatCount(status.lagHours))}
                  </span>
                ) : null}
              </label>
              <div className="scope-plots">
                {PERIODS.map((period) => {
                  const driver = overview.views[period]?.drivers.find(
                    (candidate) => candidate.scope === scope.slug,
                  );
                  if (driver === undefined) return null;
                  const digits = driverDigits(driver.series);
                  const columns = driverColumns(
                    driver.series,
                    digits,
                    driver.events,
                  );
                  return (
                    <ChainDrivers
                      key={period}
                      chain={scope.slug}
                      series={driver.series}
                      events={driver.events}
                      columns={columns}
                      digits={digits}
                      extent={flowBound(driverExtent(columns))}
                      chains={overview.chains}
                      status={status}
                      period={period}
                      pos={index}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
