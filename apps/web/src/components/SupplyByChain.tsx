import type { ChainStatus, Overview, Series } from '@app/contracts';
import {
  columnWidth,
  columnX,
  coordinate,
  fraction,
  fractionY,
  levelAxis,
  linePath,
  maxOf,
  plotHeight,
  scale,
  segments,
  unscale,
  type Frame,
  type ChartMarker,
  type TooltipColumn,
  chainInfo,
  type Chains,
  isShortHistory,
  type PeriodId,
  fromSeries,
  qualityAttribute,
  flagRuns,
  lineValues,
  stackFromBoundaries,
  tooltipText,
  tooltipTitle,
} from '@app/view';
import {
  formatCompact,
  formatCount,
  formatEnds,
  formatHistoryRange,
  formatRange,
  formatDay,
  bucketLabel,
  formatSeriesValue,
  runLabel,
  shortDay,
  supplyTooltips,
} from '../view.ts';
import { texts } from '../texts.ts';
import { Chart, ColumnBands, type Tick } from './Chart.tsx';
import { QualityNote } from './QualityNote.tsx';
import { SectionHeading } from './SectionHeading.tsx';

const WIDE = { width: 1000, left: 2, right: 2, top: 6, bottom: 2 } as const;
const HEIGHT = { level: 240, share: 120 } as const;
const clamp = (value: number): number => Math.min(1, Math.max(0, value));
const percentOf = (value: number): string => `${coordinate(value * 100)}%`;

/**
 * formatCompact rounds to two decimals (20.00B); the axis wants no trailing zeros: 20B, never
 * 100.00B. Only those decimals of formatCompact are trimmed here; its compact units are the ones
 * used, no other compact formatter exists.
 */
const axisLabel = (value: string): string => formatCompact(value).replace(/(\.\d*?)0+(?=\D|$)/, '$1').replace(/\.(?=\D|$)/, '');

/**
 * A stacked area by chain, layers in `overview.chains` order. A day where any chain is null is a gap
 * in the whole stack: an unknown value is not stacked as 0, and each run of known days is its own
 * shape. Incomplete buckets are shaded; points listed in a line's `unreconciled` are hollow
 * diamonds. The level panel runs to the tracked total plus 5 % on a whole axis step, with the total
 * line on the stack and the direct labels beside it; the share panel is 0–100 %.
 */
function StackedArea({ series, boundaries, levels, total, chains, status, kind, dates, tooltips }: {
  series: Series;
  boundaries: Series;
  levels: Series;
  total: Series;
  chains: Chains;
  status: readonly ChainStatus[];
  kind: 'level' | 'share';
  dates: boolean;
  tooltips: readonly TooltipColumn[];
}) {
  const { buckets } = series;
  const lines = [...series.lines].sort((a, b) => chainInfo(chains, a.key).index - chainInfo(chains, b.key).index);
  const values = lines.map(lineValues);
  const stack = stackFromBoundaries(boundaries, levels);
  const { digits, missing, tops } = stack;
  const frame: Frame = { ...WIDE, height: HEIGHT[kind], columns: buckets.length };
  const readyTotal = scale(lineValues(total.lines[0] ?? { values: [] }), digits).values;
  const axis = kind === 'share' ? null : levelAxis(maxOf(readyTotal) ?? 0n);
  const max = kind === 'share' ? (scale(['100'], digits).values[0] ?? 0n) : (axis?.top ?? 0n);
  const fractionOf = (value: bigint): number => (max === 0n ? 0 : clamp(fraction(value, 0n, max)));
  const y = (value: bigint): number => fractionY(frame, fractionOf(value));
  const half = columnWidth(frame) / 2;
  const label = texts.supplyByChain[kind];
  const names = lines.map((line) => chainInfo(chains, line.key).name);
  const first = buckets[0];
  const last = buckets.at(-1);
  const lastIndex = buckets.length - 1;
  const text = (index: number, layer: number): string => {
    const value = values[layer]?.[index] ?? null;
    return kind === 'share' && value === null ? texts.na.label : formatSeriesValue(series.unit, value);
  };

  const lower = (layer: number, index: number): bigint => (layer === 0 ? 0n : (tops[layer - 1]?.[index] ?? 0n));
  const area = (layer: number, [from, to]: [number, number]): string => {
    // Left to right along the top of the layer, then back right to left along its bottom.
    const upper: string[] = [];
    const lowerEdge: string[] = [];
    for (let index = from; index <= to; index += 1) {
      const xs = from === to ? [columnX(frame, index) - half, columnX(frame, index) + half] : [columnX(frame, index)];
      const top = coordinate(y(tops[layer]?.[index] ?? 0n));
      const base = coordinate(y(lower(layer, index)));
      for (const x of xs) {
        upper.push(`${coordinate(x)} ${top}`);
        lowerEdge.push(`${coordinate(x)} ${base}`);
      }
    }
    const bottom = lowerEdge.reverse();
    return `M${[...upper, ...bottom].join('L')}Z`;
  };
  // The top edge of a layer run: the same points as the area's upper edge, without the baseline.
  const topEdge = (layer: number, [from, to]: [number, number]): string => {
    const points: string[] = [];
    for (let index = from; index <= to; index += 1) {
      const xs = from === to ? [columnX(frame, index) - half, columnX(frame, index) + half] : [columnX(frame, index)];
      const top = coordinate(y(tops[layer]?.[index] ?? 0n));
      for (const x of xs) points.push(`${coordinate(x)} ${top}`);
    }
    return `M${points.join('L')}`;
  };
  const runs = segments(buckets.length, (index) => !missing[index]);
  const gaps = flagRuns(missing);

  // The layer boundary at a column; a flagged column without a stack sits on the baseline.
  const boundary = (layer: number, index: number): number => {
    const top = tops[layer]?.[index];
    return top === null || top === undefined ? fractionY(frame, 0) : y(top);
  };
  const separators = lines.slice(0, -1).map((_, layer) =>
    linePath(buckets.map((_bucket, index) => (missing[index] || (tops[layer]?.[index] ?? null) === null ? null : { x: columnX(frame, index), y: boundary(layer, index) }))));

  // The structured card needs one column per tip; a length mismatch (contract violation) falls back
  // to the plain string path instead of pairing the wrong rows with the wrong column.
  const columns = tooltips.length === buckets.length ? tooltips : undefined;
  const tips = buckets.map((bucket, index) => {
    const column = columns?.[index];
    return column === undefined
      ? `${bucketLabel(bucket)}: ${lines.map((line, layer) => `${names[layer] ?? line.key} ${text(index, layer)}`).join(' · ')}`
      : tooltipTitle(column);
  });
  // The live region announces the whole card, the quality line with the chain name included.
  const announcements = columns?.map((column) => tooltipText(column));
  // One ready coordinate per known layer boundary, only on the level panel.
  const lastLayer = lines.length - 1;
  const markers: ChartMarker[][] | undefined = kind === 'share' ? undefined : buckets.map((_bucket, index) =>
    missing[index] ? [] : lines.flatMap((line, layer) => {
      const top = tops[layer]?.[index] ?? null;
      return top === null ? [] : [{ at: y(top) / frame.height, chain: chainInfo(chains, line.key).index }];
    }));

  // Anchor the column to the top layer's midpoint. CSS applies the token step,
  // independent of plot scaling; no label is suppressed for a thin layer.
  const wanted = lines.map((_, layer) => {
    const upper = tops[layer]?.[lastIndex];
    if (upper === null || upper === undefined) return 1 - (layer + 0.5) / Math.max(1, lines.length);
    return (frame.top + plotHeight(frame) * (1 - (fractionOf(upper) + fractionOf(lower(layer, lastIndex))) / 2)) / frame.height;
  });
  const anchor = percentOf(wanted[lastLayer] ?? 0);

  // Horizontal gridlines at the steps of the axis and nowhere else.
  const gridAt = (kind === 'share' ? [0.25, 0.5, 0.75].map((at) => frame.top + plotHeight(frame) * at) : (axis?.grid ?? []).map((value) => y(value))).map((at) =>
    coordinate(at),
  );
  const ticks: Tick[] =
    kind === 'share'
      ? [{ at: 0, label: '100%' }, { at: 0.5, label: '50%' }, { at: 1, label: '0' }]
      : axis === null || axis.grid.length === 0
        ? [{ at: 1, label: formatCompact('0') }]
        : [
            { at: 0, label: axisLabel(unscale(axis.top, digits)) },
            ...axis.grid
              .slice(0, -1)
              .reverse()
              .map((value) => ({ at: 1 - fractionOf(value), label: axisLabel(unscale(value, digits)) })),
            { at: 1, label: formatCompact('0') },
          ];
  const marks: Tick[] =
    buckets.length < 8
      ? []
      : [0.25, 0.5, 0.75].flatMap((at) => {
          const index = Math.round(at * lastIndex);
          const bucket = buckets[index];
          return bucket === undefined ? [] : [{ at: (index + 0.5) / buckets.length, label: shortDay(bucket.end), minor: true }];
        });
  const ends = first && last ? formatEnds(first.start, last.end) : null;
  const range = first && last ? formatRange(first.start, last.end) : texts.noData;
  const lastDay = last
    ? (series.period === 'day' ? texts.supplyByChain.lastDay(shortDay(last.end)) : texts.resolution.end(texts.resolution.units[series.period] ?? series.period) + ' · ' + bucketLabel(last))
    : texts.noData;
  const description = texts.supplyByChain.describe(
    label + ', ' + (texts.resolution.steps[series.period] ?? series.period),
    range,
    last ? `${shortDay(last.end)}: ${lines.map((line, layer) => `${names[layer] ?? line.key} ${text(lastIndex, layer)}`).join(', ')}.` : texts.noData,
  );

  return (
    <figure className="areas" data-series={kind}>
      <figcaption className="chart-k">
        <span className="label">{label}</span>
        <span className="caption">{kind === 'share' ? texts.supplyByChain.shareRange : lastDay}</span>
      </figcaption>
      <Chart
        frame={frame}
        tips={tips}
        tooltips={columns}
        announcements={announcements}
        markers={markers}
        label={description}
        stretch
        variant={kind}
        axis={{
          top: ticks[0]?.label ?? '',
          bottom: ticks.at(-1)?.label ?? '',
          ticks,
          start: dates ? ends?.[0] : undefined,
          end: dates ? ends?.[1] : undefined,
          marks: dates ? marks : undefined,
        }}
        overlay={lines.flatMap((line, layer) =>
          line.unreconciled.map((index) => (
            <span
              key={`${line.key}-${index}`}
              className="chart-point ovl-dia"
              data-unreconciled="true"
              data-chain-index={chainInfo(chains, line.key).index}
              style={{ left: percentOf(columnX(frame, index) / frame.width), top: percentOf(boundary(layer, index) / frame.height) }}
              aria-hidden="true"
            />
          )))}
        aside={
          kind === 'level'
            ? lines.map((line, layer) => {
                const info = chainInfo(chains, line.key);
                const lag = status.find((candidate) => candidate.chain === line.key);
                const row = columns?.[lastIndex]?.rows.find((candidate) => candidate.chain === info.index);
                return (
                  <span
                    key={line.key}
                    className="dlab"
                    data-chain-index={info.index}
                    style={{ top: `calc(${anchor} + ${lastLayer - layer} * var(--chart-chain-label-step))` }}
                  >
                    {info.name}{' '}
                    <b className="dlab-value">{row?.value ?? texts.na.label}</b>
                    <span className="dlab-share">{row?.share ?? texts.na.label}</span>
                    {lag?.state === 'delayed' && lag.lagHours !== null ? (
                      <span className="tag delayed">{texts.tags.behindLabel(formatCount(lag.lagHours))}</span>
                    ) : null}
                  </span>
                );
              })
            : []
        }
      >
        {gridAt.map((at) => <line key={at} className="agrid" x1={frame.left} x2={frame.width - frame.right} y1={at} y2={at} />)}
        <ColumnBands frame={frame} incomplete={buckets.map((bucket) => !bucket.complete)} missing={missing} />
        {lines.map((line, layer) => (
          <g key={line.key} className="chart-layer" data-chain-index={chainInfo(chains, line.key).index}>
            {runs.map((run) => <path key={run[0]} className="area" d={area(layer, run)} />)}
          </g>
        ))}
        {separators.map((d, layer) => <path key={layer} className="asep" d={d} />)}
        {kind === 'level' ? runs.map((run) => <path key={`total-${run[0]}`} className="atotal" d={topEdge(lastLayer, run)} />) : null}
        <line className="azero" x1={frame.left} x2={frame.width - frame.right} y1={coordinate(fractionY(frame, 0))} y2={coordinate(fractionY(frame, 0))} />
      </Chart>
      {gaps.length === 0 ? null : (
        <p className="chart-note" data-note="no-data">{gaps.map((run) => texts.supplyByChain.gapNote(runLabel(buckets, run))).join(' · ')}</p>
      )}
    </figure>
  );
}

/** Chart 2: supply by chain over the common history, in tokens and in shares, on one time axis. */
export function SupplyByChain({ overview, period = 'all', block = 'supply-by-chain', headingId = 'h-supply-by-chain' }: {
  overview: Overview;
  /**
   * The window this copy shows. The internal default is `all` so a direct render is the whole history
   * exactly as before; PageView always passes an explicit period for each of its three copies.
   */
  period?: PeriodId;
  /**
   * The block marker for the page checks. Only the visible default copy carries the canonical
   * `supply-by-chain`: hidden copies pass null and render no `data-block` at all.
   */
  block?: string | null;
  /** The heading id; hidden copies pass a suffixed one so no `id` is duplicated. */
  headingId?: string;
}) {
  const source = overview.views[period]?.supplyByChain;
  if (source === undefined) return null;
  const { level, share, total, stackedLevel, stackedShare } = source;
  const tooltips = supplyTooltips(level, share, total, overview.chains, overview.status.chains);
  const summary = fromSeries(level);
  const first = level.buckets[0];
  const last = level.buckets.at(-1);
  const range = first && last ? formatHistoryRange(first.start, last.end) : texts.noData;
  const windowRange = first && last ? formatRange(first.start, last.end) : texts.noData;
  const caption =
    isShortHistory(overview) && overview.historyStart !== null
      ? texts.supplyByChain.shortHistory(formatDay(overview.historyStart))
      : period === 'all'
        ? texts.supplyByChain.caption(range, overview.chains.map((chain) => chain.name))
        : texts.supplyByChain.windowCaption(windowRange, overview.chains.map((chain) => chain.name));
  return (
    <section className="sec" data-block={block ?? undefined} data-period={period} data-quality={qualityAttribute(summary)} aria-labelledby={headingId}>
      <SectionHeading
        index={3}
        label={texts.supplyByChain.title}
        title={texts.supplyByChain.headline}
        caption={caption}
        id={headingId}
      />
      <QualityNote summary={summary} points step={texts.resolution.units[level.period] ?? level.period} />
      <div className="supply-plots">
        <StackedArea series={level} boundaries={stackedLevel} levels={level} total={total} chains={overview.chains} status={overview.status.chains} kind="level" dates={false} tooltips={tooltips} />
        <StackedArea series={share} boundaries={stackedShare} levels={level} total={total} chains={overview.chains} status={overview.status.chains} kind="share" dates tooltips={tooltips} />
      </div>
      {level.lines.some((line) => line.values.includes(null)) ? (
        <p className="chart-note">{texts.supplyByChain.missing}</p>
      ) : null}
    </section>
  );
}
