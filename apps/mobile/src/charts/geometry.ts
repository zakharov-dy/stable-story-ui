import { columnWidth, columnX, coordinate, segments } from '@app/view';
import type { Frame } from '@app/view';

export function bandPath(frame: Frame, present: (index: number) => boolean,
  edge: (index: number) => number, base: (index: number) => number) {
  return segments(frame.columns, present).map(([from, to]) => {
    const upper: string[] = [];
    const lower: string[] = [];
    for (let index = from; index <= to; index++) {
      const center = columnX(frame, index);
      const half = columnWidth(frame) / 2;
      const left = index === from ? center - half : center;
      const right = index === to ? center + half : center;
      for (const x of left === right ? [left] : [left, right]) {
        upper.push(`${coordinate(x)} ${coordinate(edge(index))}`);
        lower.push(`${coordinate(x)} ${coordinate(base(index))}`);
      }
    }
    return `M${[...upper, ...lower.reverse()].join('L')}Z`;
  }).join('');
}
