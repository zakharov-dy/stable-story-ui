import { createFormat, createTooltip } from '@app/view';
import { describe, expect, it } from 'vitest';
import { texts } from './texts.ts';
import { formatAmount, formatShare } from './view.ts';

describe('client-owned view labels', () => {
  it('keeps independently bound clients and the web wording separate', () => {
    const firstLabels = { ...texts, noData: 'first missing', minus: 'first minus ', percent: 'first percent' };
    const secondLabels = { ...texts, noData: 'second missing', minus: 'second minus ', percent: 'second percent' };
    const first = createFormat(firstLabels);
    const second = createFormat(secondLabels);
    const firstTooltip = createTooltip(firstLabels);
    const secondTooltip = createTooltip(secondLabels);

    expect(first.formatAmount(null)).toBe('first missing');
    expect(second.formatAmount(null)).toBe('second missing');
    expect(firstTooltip.formatShare('-1')).toBe('first minus 1.0first percent');
    expect(secondTooltip.formatShare('-1')).toBe('second minus 1.0second percent');
    expect(first.formatAmount('-2')).toBe('first minus 2');
    expect(second.formatAmount('-2')).toBe('second minus 2');
    expect(formatAmount(null)).toBe(texts.noData);
    expect(formatShare('-1')).toBe('−1.0%');
  });
});
