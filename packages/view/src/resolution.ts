// Display classification only: the server already selected and partitioned these intervals. The
// rule mirrors the contract's `cut` (packages/contracts/src/overview-invariants.ts): a first/last
// interval is partial when it does not cover the whole calendar week or month it intersects.
import type { Series } from '@app/contracts';

export function isPartialBucket(bucket: Series['buckets'][number], period: Series['period']): boolean {
  if (period === 'day' || period === 'all') return false;
  if (period === 'week') {
    const start = new Date(Date.parse(bucket.start + 'T00:00:00Z'));
    const weekEnd = new Date(start.getTime() + (6 - ((start.getUTCDay() + 6) % 7)) * 86_400_000).toISOString().slice(0, 10);
    return start.getUTCDay() !== 1 || bucket.end !== weekEnd;
  }
  if (period === 'month') {
    const next = new Date(Date.parse(bucket.end) + 86_400_000);
    return bucket.start.slice(-2) !== '01' || next.getUTCDate() !== 1;
  }
  return false;
}
