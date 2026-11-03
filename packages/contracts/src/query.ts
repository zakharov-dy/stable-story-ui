// Query parameters. The schemas parse the query string as it arrives
// over the wire (every value is a string) and output typed values with the defaults applied.
// What needs the registry or the data stays on the server: an unknown or disabled chain (400), an
// unknown asset (404), one bound without coverage (400), the cursor fingerprint (400).

import { z } from 'zod';
import { Day, Flow, Period } from './primitives.ts';

/** A comma-separated list: absent or empty = [] (all), empty items are an error, duplicates are removed. */
const csvList = <T extends z.ZodType<string, string>>(item: T) =>
  z
    .string()
    .transform((value) => (value === '' ? [] : value.split(',')))
    .pipe(z.array(item))
    .transform((list) => [...new Set(list)])
    .default(() => []);

const asset = z.string().min(1).default('usdc');
const chains = csvList(z.string().min(1));
const flows = csvList(Flow);
const dates = { from: Day.optional(), to: Day.optional() };

const fromNotAfterTo = {
  check: (query: { from?: string | undefined; to?: string | undefined }): boolean =>
    query.from === undefined || query.to === undefined || query.from <= query.to,
  params: { path: ['from'], message: '`from` is after `to`' },
};

export const SERIES_METRICS = [
  'level',
  'share',
  'issuer_mint',
  'issuer_burn',
  'bridge_in',
  'bridge_out',
  'net_change',
  'turnover',
  'issuer_share_in',
  'issuer_share_out',
] as const;
export const SeriesMetric = z.enum(SERIES_METRICS);
export type SeriesMetric = z.infer<typeof SeriesMetric>;

export const SeriesBasis = z.enum(['volume', 'count']);
export type SeriesBasis = z.infer<typeof SeriesBasis>;

export const SeriesTransform = z.enum(['none', 'change', 'change_pct', 'rolling_7d', 'rolling_30d', 'cumulative']);
export type SeriesTransform = z.infer<typeof SeriesTransform>;

export const SeriesGroupBy = z.enum(['none', 'chain', 'flow']);
export type SeriesGroupBy = z.infer<typeof SeriesGroupBy>;

export const EventsSort = z.enum(['amount', 'time']);
export type EventsSort = z.infer<typeof EventsSort>;

const SHARES: readonly SeriesMetric[] = ['share', 'issuer_share_in', 'issuer_share_out'];

// Shares: only none, change, change_pct. Level: no cumulative. Flows, net_change, turnover: all.
const allowedTransforms = (metric: SeriesMetric): readonly SeriesTransform[] => {
  if (SHARES.includes(metric)) return ['none', 'change', 'change_pct'];
  if (metric === 'level') return ['none', 'change', 'change_pct', 'rolling_7d', 'rolling_30d'];
  return SeriesTransform.options;
};

export const OverviewQuery = z.object({ asset });
export type OverviewQuery = z.infer<typeof OverviewQuery>;

export const SeriesQuery = z
  .object({
    asset,
    metric: SeriesMetric.default('level'),
    basis: SeriesBasis.default('volume'),
    transform: SeriesTransform.default('none'),
    chains,
    groupBy: SeriesGroupBy.default('none'),
    period: Period.default('day'),
    ...dates,
  })
  .refine(fromNotAfterTo.check, fromNotAfterTo.params)
  .superRefine((query, ctx) => {
    if (query.basis === 'count' && (query.metric === 'level' || query.metric === 'share')) {
      ctx.addIssue({ code: 'custom', path: ['basis'], message: `basis=count is not available for metric=${query.metric}` });
    }
    if (!allowedTransforms(query.metric).includes(query.transform)) {
      ctx.addIssue({
        code: 'custom',
        path: ['transform'],
        message: `transform=${query.transform} is not available for metric=${query.metric}`,
      });
    }
    if (query.groupBy === 'flow' && query.metric !== 'net_change' && query.metric !== 'turnover') {
      ctx.addIssue({
        code: 'custom',
        path: ['groupBy'],
        message: `groupBy=flow is available only for metric=net_change and metric=turnover`,
      });
    }
  });
export type SeriesQuery = z.infer<typeof SeriesQuery>;

export const EventsQuery = z
  .object({
    asset,
    chains,
    flows,
    ...dates,
    sort: EventsSort.default('amount'),
    limit: z
      .string()
      .regex(/^(?:0|[1-9]\d*)$/, 'Expected an integer')
      .transform(Number)
      .pipe(z.int().min(1).max(100))
      .default(20),
    cursor: z.string().min(1).optional(), // opaque; parsed and checked on the server
  })
  .refine(fromNotAfterTo.check, fromNotAfterTo.params);
export type EventsQuery = z.infer<typeof EventsQuery>;

export const EventsStatsQuery = z
  .object({ asset, chains, flows, ...dates })
  .refine(fromNotAfterTo.check, fromNotAfterTo.params);
export type EventsStatsQuery = z.infer<typeof EventsStatsQuery>;
