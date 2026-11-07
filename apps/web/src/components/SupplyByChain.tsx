import type { Overview, OverviewView, Series } from '@app/contracts';
import {
  chainInfo,
  type Chains,
  columnWidth,
  columnX,
  commonDigits,
  coordinate,
  fraction,
  fractionY,
  levelAxis,
  linePath,
  lineValues,
  maxOf,
  scale,
  segments,
  unscale,
  fromSeries,
  qualityAttribute,
  PERIODS,
  tooltipText,
  type Frame,
  type TooltipColumn,
} from '@app/view';
import {
  assetName,
  bucketLabel,
  formatCompact,
  formatDay,
  formatShare,
  formatShortDay,
  formatMonth,
  offPeriods,
  roundedChange,
  tone,
} from '../view.ts';
import { texts } from '../texts.ts';
import { Chart, type Tick } from './Chart.tsx';
import { PeriodSwitch } from './PeriodSwitch.tsx';

/** Known layers use the supplied cumulative boundary, skipping chains absent before coverage. */
export function stackGeometry(
  view: OverviewView,
  kind: 'level' | 'share',
  chains: Chains,
) {
  const source = view.supplyByChain;
  const boundaries =
    kind === 'level' ? source.stackedLevel : source.stackedShare;
  const ordered = [...boundaries.lines].sort(
    (a, b) => chainInfo(chains, a.key).index - chainInfo(chains, b.key).index,
  );
  const digits = commonDigits(
    ...ordered.map(lineValues),
    ...source.total.lines.map(lineValues),
  );
  const tops = ordered.map((line) => scale(lineValues(line), digits).values);
  const absent = view.noDataChains ?? source.level.buckets.map(() => []);
  const missing = source.level.buckets.map((_, index) =>
    source.level.lines.some(
      (line) =>
        line.values[index] === null && !absent[index]?.includes(line.key),
    ),
  );
  const layers = ordered.map((line, layer) => ({
    key: line.key,
    index: chainInfo(chains, line.key).index,
    top: tops[layer],
    bottom: source.level.buckets.map((_, index) => {
      for (let previous = layer - 1; previous >= 0; previous -= 1) {
        if (absent[index]?.includes(ordered[previous].key)) continue;
        return tops[previous]?.[index] ?? null;
      }
      return 0n;
    }),
    known: source.level.buckets.map(
      (_, index) =>
        !missing[index] &&
        !absent[index]?.includes(line.key) &&
        source.level.lines.find((candidate) => candidate.key === line.key)
          ?.values[index] !== null &&
        tops[layer]?.[index] !== null,
    ),
  }));
  return { digits, layers, missing };
}

function supplyColumns(
  view: OverviewView,
  overview: Overview,
): TooltipColumn[] {
  const { level, share, total } = view.supplyByChain;
  return level.buckets.map((bucket, index) => {
    const readyTotal = total.lines[0]?.values[index] ?? null;
    const flagged = level.lines.some((line) =>
      line.unreconciled.includes(index),
    );
    return {
      header: {
        label: texts.header.cards.supply,
        value: formatCompact(readyTotal === null ? null : String(readyTotal)),
        share:
          readyTotal === null || readyTotal === '0'
            ? undefined
            : texts.supplyByChain.shareTotal,
      },
      rows: overview.chains
        .map((chain, at) => {
          const value =
            level.lines.find((line) => line.key === chain.slug)?.values[
              index
            ] ?? null;
          const pct =
            share.lines.find((line) => line.key === chain.slug)?.values[
              index
            ] ?? null;
          return {
            label: chain.name,
            value: formatCompact(value === null ? null : String(value)),
            share: formatShare(pct === null ? null : String(pct)),
            chain: at + 1,
          };
        })
        .reverse(),
      note: flagged
        ? { text: texts.resolution.flagged, tone: 'unreconciled' }
        : undefined,
      footer: {
        label: bucketLabel(bucket),
        value:
          level.period === 'day'
            ? texts.supplyByChain.endOfDay
            : texts.resolution.levelEnd(level.period),
      },
    };
  });
}

/** Date positions select supplied buckets. They do not create time buckets. */
export function dateTicks(series: Series): Tick[] {
  const last = series.buckets.length - 1;
  const first = series.buckets[0];
  const end = series.buckets.at(-1);
  const crossYear = first?.start.slice(0, 4) !== end?.end.slice(0, 4);
  const marks = [0.2, 0.4, 0.6, 0.8].map((at) => ({
    at,
    minor: true,
    phone: false,
  }));
  if (!crossYear || series.period === 'month')
    marks.push(
      ...[1 / 3, 2 / 3].map((at) => ({ at, minor: false, phone: true })),
    );
  return marks.flatMap(({ at, minor, phone }) => {
    const bucket = series.buckets[Math.round(last * at)];
    return bucket === undefined
      ? []
      : [
          {
            at,
            label:
              series.period === 'month'
                ? formatMonth(bucket.end)
                : formatShortDay(bucket.end),
            minor,
            phone,
          },
        ];
  });
}

function StackPlot({
  overview,
  view,
  kind,
}: {
  overview: Overview;
  view: OverviewView;
  kind: 'level' | 'share';
}) {
  const { level, total } = view.supplyByChain;
  const { digits, layers, missing } = stackGeometry(
    view,
    kind,
    overview.chains,
  );
  const frame: Frame = {
    width: 1000,
    height: 340,
    left: 2,
    right: 2,
    top: 6,
    bottom: 2,
    columns: level.buckets.length,
  };
  const totals = scale(lineValues(total.lines[0]), digits).values;
  const peak = overview.records.find(
    (record) => record.scope === 'all' && record.kind === 'max_supply',
  );
  const peakIndex =
    peak?.day === null || peak?.day === undefined
      ? -1
      : level.buckets.findIndex(
          (bucket) => bucket.start <= peak.day! && bucket.end >= peak.day!,
        );
  const peakValue =
    peak?.value === null || peak?.value === undefined
      ? null
      : scale([peak.value], digits).values[0];
  const axis = levelAxis(
    maxOf(peakIndex >= 0 ? [...totals, peakValue ?? null] : totals) ?? 0n,
  );
  const max = kind === 'share' ? scale(['100'], digits).values[0]! : axis.top;
  const ratio = (value: bigint) => (max === 0n ? 0 : fraction(value, 0n, max));
  const y = (value: bigint) => fractionY(frame, ratio(value));
  const x = (index: number) => columnX(frame, index);
  const half = columnWidth(frame) / 2;
  const path = (
    top: readonly (bigint | null)[],
    bottom: readonly (bigint | null)[],
    [from, to]: [number, number],
  ) => {
    const upper: string[] = [];
    const lower: string[] = [];
    for (let index = from; index <= to; index += 1) {
      const xs = from === to ? [x(index) - half, x(index) + half] : [x(index)];
      for (const at of xs) {
        upper.push(`${coordinate(at)} ${coordinate(y(top[index]!))}`);
        lower.push(`${coordinate(at)} ${coordinate(y(bottom[index]!))}`);
      }
    }
    return `M${[...upper, ...lower.reverse()].join('L')}Z`;
  };
  const columns = supplyColumns(view, overview);
  const ticks: Tick[] =
    kind === 'share'
      ? [
          { at: 0, label: texts.supplyByChain.shareTotal },
          { at: 0.5, label: texts.axis.halfShare },
          { at: 1, label: texts.axis.zero },
        ]
      : [
          ...axis.grid.map((value) => ({
            at: 1 - ratio(value),
            label: formatCompact(unscale(value, digits)).replace(
              /\.0+(?=\D|$)/,
              '',
            ),
          })),
          { at: 1, label: texts.axis.zero },
        ];
  const points = totals.map((value, index) =>
    value === null || missing[index] ? null : { x: x(index), y: y(value) },
  );
  const lastIndex = points.length - 1;
  const dashed = level.lines.some((line) =>
    line.unreconciled.includes(lastIndex),
  );
  const first = level.buckets[0];
  const last = level.buckets.at(-1);
  return (
    <figure className="areas" data-series={kind}>
      <Chart
        frame={frame}
        tips={columns.map(tooltipText)}
        tooltips={columns}
        label={`${texts.supplyByChain[kind]}, ${texts.resolution.steps[view.period]}`}
        stretch
        variant={kind}
        axis={{
          top: '',
          bottom: '',
          ticks,
          start:
            first === undefined
              ? undefined
              : view.period === 'month'
                ? formatMonth(first.end)
                : formatShortDay(first.end),
          end:
            last === undefined
              ? undefined
              : view.period === 'month'
                ? formatMonth(last.end)
                : formatShortDay(last.end),
          marks: dateTicks(level),
        }}
        markers={level.buckets.map((_, index) =>
          kind === 'share'
            ? []
            : layers.flatMap((layer) =>
                layer.known[index]
                  ? [
                      {
                        at: y(layer.top[index]!) / frame.height,
                        chain: layer.index,
                      },
                    ]
                  : [],
              ),
        )}
        overlay={
          kind === 'level' &&
          peakIndex >= 0 &&
          peakValue !== null &&
          peakValue !== undefined ? (
            <span
              className={`peak ${peakIndex > level.buckets.length / 2 ? 'peak-left' : ''}`}
              style={{
                left: `${(x(peakIndex) / frame.width) * 100}%`,
                top: `max(2.9em, ${(y(peakValue) / frame.height) * 100}%)`,
              }}
            >
              {texts.supplyByChain.peak(
                formatCompact(peak!.value),
                formatDay(peak!.day),
              )}
            </span>
          ) : undefined
        }
      >
        {ticks
          .filter((tick) => tick.at !== 1)
          .map((tick) => (
            <line
              key={tick.label}
              className="agrid"
              x1={frame.left}
              x2={frame.width - frame.right}
              y1={coordinate(fractionY(frame, 1 - tick.at))}
              y2={coordinate(fractionY(frame, 1 - tick.at))}
            />
          ))}
        {layers.map((layer) => (
          <g
            key={layer.key}
            className="chart-layer"
            data-chain-index={layer.index}
            data-chain={layer.key}
          >
            {segments(
              level.buckets.length,
              (index) =>
                layer.known[index] === true && layer.bottom[index] !== null,
            ).map((run) => (
              <path
                key={run[0]}
                className="area"
                d={path(layer.top, layer.bottom, run)}
              />
            ))}
            <path
              className="asep"
              d={linePath(
                layer.top.map((value, index) =>
                  value === null || !layer.known[index]
                    ? null
                    : { x: x(index), y: y(value) },
                ),
              )}
            />
          </g>
        ))}
        {kind === 'level' ? (
          <>
            <path
              className="atotal"
              d={linePath(dashed ? points.slice(0, -1) : points)}
            />
            {dashed ? (
              <path
                className="atotal net-dash"
                data-unreconciled="true"
                d={linePath(points.slice(-2))}
              />
            ) : null}
          </>
        ) : null}
        <line
          className="azero"
          x1={frame.left}
          x2={frame.width - frame.right}
          y1={y(0n)}
          y2={y(0n)}
        />
      </Chart>
    </figure>
  );
}

export function ChainList({ overview }: { overview: Overview }) {
  const source = overview.views['30d']?.supplyByChain;
  return (
    <div className="clist" aria-label={texts.supplyByChain.title}>
      <div className="clist-head">
        <span>{texts.supplyByChain.chain}</span>
        <span>{texts.supplyByChain.level}</span>
        <span>{texts.supplyByChain.share}</span>
        <span>
          {overview.day === null
            ? texts.noData
            : formatShortDay(overview.day.date)}
        </span>
        <span />
      </div>
      {overview.chains.map((chain, index) => {
        const status = overview.status.chains.find(
          (item) => item.chain === chain.slug,
        );
        const value =
          source?.level.lines
            .find((line) => line.key === chain.slug)
            ?.values.at(-1) ?? null;
        const share =
          source?.share.lines
            .find((line) => line.key === chain.slug)
            ?.values.at(-1) ?? null;
        const day = overview.day?.rows.find((row) => row.scope === chain.slug);
        const lastFailed =
          status?.lastClosedDay !== null &&
          status?.lastClosedDay !== undefined &&
          status.unreconciledDays.includes(status.lastClosedDay);
        const unreconciled =
          day?.unreconciled === true ||
          lastFailed ||
          status?.state === 'unreconciled';
        const quality =
          status?.state === 'no_data'
            ? 'incomplete'
            : unreconciled
              ? status?.state === 'delayed'
                ? 'delayed unreconciled'
                : 'unreconciled'
              : (status?.state ?? 'incomplete');
        const mark =
          status?.state === 'delayed'
            ? texts.tags.behindLabel(formatCountLag(status.lagHours))
            : unreconciled
              ? texts.status.unreconciled
              : texts.status.checkMarks.ok;
        return (
          <a
            key={chain.slug}
            href="#chain-status"
            className="crow"
            data-chain-index={index + 1}
            data-chain={chain.slug}
            data-chain-state={status?.state}
            data-quality={quality}
          >
            <span className="dot" />
            <span className="cn">{chain.name}</span>
            <span className="cl">
              {formatCompact(value === null ? null : String(value))}
            </span>
            <span className="cs">
              {formatShare(share === null ? null : String(share)) ??
                texts.noData}
            </span>
            <span className={`cd ${tone(day?.values.net ?? null)}`}>
              {roundedChange(day?.values.net ?? null)}
            </span>
            <span className={`cm ${status?.state ?? ''}`}>
              {status?.state === 'no_data' ? texts.noData : mark}
              {status?.state === 'delayed' && unreconciled ? (
                <span className="unrec"> {texts.status.unreconciled}</span>
              ) : null}
            </span>
          </a>
        );
      })}
    </div>
  );
}

const formatCountLag = (hours: number | null) =>
  hours === null ? texts.noData : String(hours);

export function SupplyByChain({ overview }: { overview: Overview }) {
  const reason =
    offPeriods(overview).has('all') && overview.historyStart !== null
      ? texts.period.allNote(formatDay(overview.historyStart))
      : null;
  return (
    <div className="supply-layout" data-block="supply-by-chain">
      <div className="stack-panel">
        <div className="chart-head">
          <fieldset className="seg mode">
            <legend className="sr">{texts.supplyByChain.title}</legend>
            {(['level', 'share'] as const).map((kind) => (
              <label key={kind}>
                <input
                  name="stack-mode"
                  type="radio"
                  value={kind}
                  defaultChecked={kind === 'level'}
                />
                <span>{texts.supplyByChain[kind]}</span>
              </label>
            ))}
          </fieldset>
          <PeriodSwitch overview={overview} />
        </div>
        {reason === null ? null : <p className="reason">{reason}</p>}
        <div className="lane-head">
          <span>{assetName(overview)}</span>
          <span className="lane-rule" />
        </div>
        {PERIODS.map((period) => {
          const view = overview.views[period];
          if (view === null) return null;
          return (
            <section
              key={period}
              data-period={period}
              data-quality={qualityAttribute(
                fromSeries(view.supplyByChain.level),
              )}
              aria-labelledby={
                period === '30d'
                  ? 'h-supply-by-chain'
                  : `h-supply-by-chain-${period}`
              }
            >
              <h2
                className="sr"
                id={
                  period === '30d'
                    ? 'h-supply-by-chain'
                    : `h-supply-by-chain-${period}`
                }
              >
                {texts.supplyByChain.title}
              </h2>
              <StackPlot overview={overview} view={view} kind="level" />
              <StackPlot overview={overview} view={view} kind="share" />
            </section>
          );
        })}
        <p className="resolution-note">{texts.resolution.sentence}</p>
      </div>
      <ChainList overview={overview} />
    </div>
  );
}
