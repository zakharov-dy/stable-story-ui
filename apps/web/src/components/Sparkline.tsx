import {
  columnWidth,
  columnX,
  coordinate,
  fraction,
  fractionY,
  linePath,
  maxOf,
  minOf,
  scale,
  segments,
  unscale,
  type Frame,
} from '@app/view';
import { formatAmount, formatEnds, formatRange, formatShortDay } from '../view.ts';
import { texts } from '../texts.ts';
import { Chart } from './Chart.tsx';

// `tall` is the monument and the day card, `compact` the band cards. The plot is squeezed into the box
// CSS gives it (64 px or 36 px high at phone width), so what must stay round is not drawn in it: the
// last point is a line with a round cap, a flagged day is an HTML diamond over the plot.
const FRAMES = {
  tall: { width: 480, height: 64, left: 4, right: 4, top: 6, bottom: 6 },
  compact: { width: 300, height: 48, left: 4, right: 4, top: 6, bottom: 6 },
} as const;

export type SparkSize = keyof typeof FRAMES;

const percentOf = (value: number): string => `${coordinate(value * 100)}%`;

/**
 * A card's spark over header.days: null is a gap (the line breaks and the run is outlined and
 * named), never 0; the points listed in the ready-made `sparkUnreconciled` are hollow diamonds (the
 * list comes from the API, nothing is recomputed here). A signed spark draws its zero line.
 */
export function Sparkline({ days, values, unreconciled, label, signed, size }: {
  days: readonly string[];
  values: readonly (string | null)[];
  unreconciled: readonly number[];
  label: string;
  signed: boolean;
  size: SparkSize;
}) {
  const frame: Frame = { ...FRAMES[size], columns: values.length };
  const { values: scaled, digits } = scale(values);
  const min = minOf(scaled);
  const max = maxOf(scaled);
  const points = scaled.map((value, index) =>
    value === null || min === null || max === null ? null : { x: columnX(frame, index), y: fractionY(frame, fraction(value, min, max)) });
  const flagged = new Set(unreconciled);
  const gaps = segments(values.length, (index) => scaled[index] === null);
  const column = columnWidth(frame);
  const ranges = gaps.flatMap(([from, to]) => {
    const start = days[from];
    const end = days[to];
    if (start === undefined || end === undefined) return [];
    return [formatRange(start, end)];
  });
  const first = days[0];
  const last = days.at(-1);
  const showZero = signed && min !== null && max !== null && min <= 0n && max >= 0n && min !== max;
  const zeroY = showZero ? coordinate(fractionY(frame, fraction(0n, min, max))) : null;
  const tips = days.map((day, index) => {
    const shown = texts.header.spark.day(formatShortDay(day), formatAmount(values[index] ?? null, { signed }));
    return flagged.has(index) ? `${shown} · ${texts.tags.unreconciledDay}` : shown;
  });
  const ends = first === undefined || last === undefined ? null : formatEnds(first, last);
  const axis = {
    top: formatAmount(max === null ? null : unscale(max, digits), { signed }),
    bottom: formatAmount(min === null ? null : unscale(min, digits), { signed }),
  };
  return (
    <div className="spark" data-size={size}>
      <Chart
        frame={frame}
        tips={tips}
        label={label}
        axis={axis}
        squeeze
        overlay={points.map((point, index) => {
          // A flagged day without a value is marked on the baseline.
          const at = point ?? (flagged.has(index) ? { x: columnX(frame, index), y: fractionY(frame, 0) } : null);
          if (at === null || !flagged.has(index)) return null;
          return (
            <span
              key={index}
              className="spark-point"
              data-unreconciled="true"
              data-missing={point === null ? 'true' : undefined}
              style={{ left: percentOf(at.x / frame.width), top: percentOf(at.y / frame.height) }}
              aria-hidden="true"
            />
          );
        })}
      >
        {gaps.map(([from, to]) => (
          <rect
            key={from}
            className="spark-gap"
            x={coordinate(columnX(frame, from) - column / 2)}
            y={frame.top}
            width={coordinate(column * (to - from + 1))}
            height={frame.height - frame.top - frame.bottom}
          />
        ))}
        {zeroY === null ? null : <line className="spark-zero" x1={frame.left} x2={frame.width - frame.right} y1={zeroY} y2={zeroY} />}
        <path className="spark-line" d={linePath(points)} />
        {points.map((point, index) =>
          index === points.length - 1 && point !== null && !flagged.has(index) ? (
            <path key={index} className="spark-dot" d={`M${coordinate(point.x)} ${coordinate(point.y)}L${coordinate(point.x)} ${coordinate(point.y)}`} />
          ) : null)}
      </Chart>
      <div className="spark-axis">
        <span>{ends?.[0]}</span>
        <span>{signed ? texts.header.spark.middle.change : texts.header.spark.middle.level}</span>
        <span>{ends?.[1]}</span>
      </div>
      {ranges.length === 0 ? null : <p className="spark-nodata">{texts.header.spark.noData(ranges)}</p>}
    </div>
  );
}
