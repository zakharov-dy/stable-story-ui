// Shared SVG pieces of the server-rendered charts.
import type { ReactNode } from 'react';
import {
  columnWidth,
  columnX,
  coordinate,
  plotHeight,
  plotWidth,
  type Frame,
  type ChartMarker,
  type TooltipColumn,
} from '@app/view';
import { texts } from '../texts.ts';
import { ChartHover } from './client/ChartHover.tsx';

/** A labelled position on an axis, as a fraction of the plot: 0 at the top / start, 1 at the bottom / end. */
export interface Tick {
  at: number;
  label: string;
  /** A date mark that is dropped at phone width, keeping fewer labels. */
  minor?: boolean;
}

/** Axis labels as HTML around the SVG, so they keep their size at any width: value strings from the data. */
export interface Axis {
  top: string;
  bottom: string;
  start?: string;
  end?: string;
  /** Value labels at plot fractions; when set they replace `top` and `bottom`. */
  ticks?: readonly Tick[];
  /** Date labels between `start` and `end`, at plot fractions from the left; hidden at phone width. */
  marks?: readonly Tick[];
}

const percent = (value: number): string => `${coordinate(value * 100)}%`;

/**
 * An SVG chart in a viewBox, with per-column native tooltips and the hydrated hover tip.
 * `stretch` fits the plot to the width at a fixed height (wide areas), `squeeze` lets CSS size it; `variant` is a CSS class of
 * the frame; `overlay` is HTML laid over the plot (positions in %); `aside` is the direct labels
 * beside the plot (below it at phone width). `tooltips` adds the structured card of a migrated chart:
 * same length as `tips`, and `markers` gives the ring height per column as a fraction of the chart.
 */
export function Chart({ frame, tips, tooltips, announcements, markers, label, axis, stretch = false, squeeze = false, variant, overlay, aside, children }: {
  frame: Frame;
  tips: readonly string[];
  tooltips?: readonly TooltipColumn[];
  /** What the live region says per column; defaults to `tips`. */
  announcements?: readonly string[];
  /** Ring height per column as a fraction of the chart height; null omits the ring. */
  markers?: readonly (readonly ChartMarker[])[];
  label: string;
  axis: Axis;
  stretch?: boolean;
  /** Fits the plot to the box CSS gives it, in either direction, without the fixed height of `stretch`. */
  squeeze?: boolean;
  variant?: string;
  overlay?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const width = columnWidth(frame);
  const classes = ['chart-frame', variant, aside === undefined ? undefined : 'has-aside'].filter(Boolean).join(' ');
  const columns = tooltips !== undefined && tooltips.length === tips.length ? tooltips : undefined;
  const spoken = announcements !== undefined && announcements.length === tips.length ? announcements : undefined;
  const rings = markers !== undefined && markers.length === tips.length ? markers : undefined;
  const hit = { top: frame.top, height: frame.height - frame.top - frame.bottom };
  const plot = {
    left: frame.left / frame.width,
    right: (frame.width - frame.right) / frame.width,
    top: frame.top / frame.height,
    bottom: (frame.height - frame.bottom) / frame.height,
  };
  return (
    <ChartHover
      frameClass={classes}
      pinOnTouch={variant === 'level'}
      closeLabel={texts.resolution.closeTooltip}
      tips={tips}
      tooltips={columns}
      announcements={spoken}
      markers={rings}
      label={label}
      stretch={stretch}
      squeeze={squeeze}
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      hits={tips.map((_tip, index) => ({ x: coordinate(columnX(frame, index) - width / 2), width: coordinate(width) }))}
      hit={hit}
      plot={plot}
      overlay={overlay}
      yAxis={axis.ticks === undefined ? (
        <div className="chart-y" aria-hidden="true">
          <span>{axis.top}</span>
          <span>{axis.bottom}</span>
        </div>
      ) : (
        <div className="chart-y ticked" aria-hidden="true">
          {axis.ticks.map((tick) => (
            <span key={tick.label + String(tick.at)} className="yl" style={{ top: percent((frame.top + plotHeight(frame) * tick.at) / frame.height) }}>
              {tick.label}
            </span>
          ))}
        </div>
      )}
      aside={aside === undefined ? null : <div className="chart-aside">{aside}</div>}
      xAxis={axis.start === undefined || axis.end === undefined ? null : (
        <div className="chart-x" aria-hidden="true">
          <span className="s">{axis.start}</span>
          {(axis.marks ?? []).map((mark) => (
            <span key={mark.label + String(mark.at)} className={mark.minor === true ? 'w minor' : 'w'} style={{ left: percent((frame.left + plotWidth(frame) * mark.at) / frame.width) }}>
              {mark.label}
            </span>
          ))}
          <span className="e">{axis.end}</span>
        </div>
      )}
    >
      {children}
    </ChartHover>
  );
}

/**
 * Column bands behind the plot: incomplete buckets (shaded) and days without data (shaded, with a
 * dashed border where a run of missing days meets known ones).
 */
export function ColumnBands({ frame, incomplete, missing }: { frame: Frame; incomplete: readonly boolean[]; missing: readonly boolean[] }) {
  const width = columnWidth(frame);
  const top = frame.top;
  const bottom = frame.height - frame.bottom;
  const edges: number[] = [];
  missing.forEach((flag, index) => {
    if (!flag) return;
    if (index > 0 && !missing[index - 1]) edges.push(index);
    if (index + 1 < missing.length && !missing[index + 1]) edges.push(index + 1);
  });
  return (
    <g className="chart-bands">
      {incomplete.map((flag, index) =>
        flag || missing[index] ? (
          <rect
            key={index}
            className="chart-band"
            data-incomplete={flag ? 'true' : undefined}
            data-missing={missing[index] ? 'true' : undefined}
            x={coordinate(columnX(frame, index) - width / 2)}
            y={top}
            width={coordinate(width)}
            height={bottom - top}
          />
        ) : null,
      )}
      {edges.map((index) => (
        <line key={index} className="chart-gap-edge" x1={coordinate(frame.left + width * index)} x2={coordinate(frame.left + width * index)} y1={top} y2={bottom} />
      ))}
    </g>
  );
}
