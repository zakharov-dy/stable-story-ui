import { Path, Rect } from '@shopify/react-native-skia';
import type { Overview, OverviewView } from '@app/contracts';
import { chainInfo, columnWidth, columnX, fraction, fractionY, levelAxis, linePath, lineValues, scale, sharedExtent, stackFromBoundaries, unscale } from '@app/view';
import { colors, chainColor, seriesText, tooltip } from '../view.ts';
import { texts } from '../texts.ts';
import { bandPath } from './geometry.ts';
import { Plot } from './Plot.tsx';

export function SupplyChart({ overview, view }: { overview: Overview; view: OverviewView }) {
  const { level, share, total, stackedLevel } = view.supplyByChain;
  return <Plot id="history.supply-chart" label={texts.header.cards.supply} series={level} build={(frame) => {
    const lines = [...stackedLevel.lines].sort((a, b) => chainInfo(overview.chains, a.key).index - chainInfo(overview.chains, b.key).index);
    const stack = stackFromBoundaries(stackedLevel, level);
    const tops = new Map(stackedLevel.lines.map((line, index) => [line.key, stack.tops[index]]));
    const absent = view.noDataChains?.map((keys) => new Set(keys));
    const missing = level.buckets.map((_, index) => level.lines.some((line) =>
      line.values[index] === null && !absent?.[index]?.has(line.key)));
    const totalLine = total.lines[0];
    const totals = totalLine ? scale(lineValues(totalLine), stack.digits).values : [];
    const axis = levelAxis(sharedExtent([...stack.tops, totals]));
    const y = (value: bigint) => fractionY(frame, fraction(value, 0n, axis.top || 1n));
    const totalPath = linePath(totals.map((value, index) => value === null || missing[index] ? null : { x: columnX(frame, index), y: y(value) }));
    const flagged = new Set(level.lines.flatMap((line) => line.unreconciled));
    const width = columnWidth(frame);
    const gaps = missing.map((isMissing, index) => isMissing ? <Rect key={index}
      x={columnX(frame, index) - width / 2} y={frame.top} width={width} height={frame.height - frame.top - frame.bottom}
      color={colors['color-shade-incomplete']} /> : null);
    return {
      grid: [0n, ...axis.grid].map((value) => ({ y: y(value), label: seriesText.axisSigned(unscale(value, stack.digits)).replace(/^\+/, '') })),
      marks: <>
        {gaps}
        {lines.map((line, layer) => {
          const upper = tops.get(line.key);
          const lower = level.buckets.map((_, index) => {
            let previous = layer - 1;
            while (previous >= 0 && absent?.[index]?.has(lines[previous].key)) previous--;
            return previous < 0 ? 0n : tops.get(lines[previous].key)?.[index] ?? null;
          });
          const path = bandPath(frame, (index) => !missing[index] && !absent?.[index]?.has(line.key) && upper?.[index] != null && lower[index] !== null,
            (index) => y(upper?.[index] ?? 0n), (index) => y(lower[index] ?? 0n));
          return path ? <Path key={line.key} path={path} color={chainColor(overview.chains, line.key)} opacity={0.84} /> : null;
        })}
        {totalPath && <Path path={totalPath} color={colors['color-text-muted']} style="stroke" strokeWidth={1} />}
        {[...flagged].map((index) => {
          const top = totals[index];
          if (missing[index] || top == null) return null;
          const x = columnX(frame, index);
          return <Path key={index} path={`M${x} ${y(top) - 4}l4 4l-4 4l-4 -4z`}
            color={colors['color-unreconciled']} style="stroke" strokeWidth={1.5} />;
        })}
      </>,
      tooltips: tooltip.supplyTooltips(level, share, total, overview.chains, overview.status.chains)
        .map((column) => ({ ...column, rows: [...column.rows].reverse() })),
    };
  }} />;
}
