// Response DTOs. Each schema and its type share one name.
// A chain, an asset and a scope are plain strings: the server checks them against
// the registry, and the list of chains comes in `Overview.chains`.

import { z } from 'zod';
import { overviewViewsIssues } from './overview-invariants.ts';
import { Amount, BlockNumber, Count, Day, Decimal, FLOWS, Flow, Indices, IsoDateTime, Period } from './primitives.ts';

const indicesWithin = (indices: number[], length: number): boolean => indices.every((index) => index < length);

interface Issue {
  path: PropertyKey[];
  message: string;
}

function invariant(valid: boolean, ctx: z.RefinementCtx, path: PropertyKey[], message: string): void {
  if (!valid) ctx.addIssue({ code: 'custom', path, message });
}

// Operation volumes and levels are unsigned; Amount itself also represents signed changes.
const NonnegativeAmount = Amount.superRefine((value, ctx) => {
  invariant(!value.startsWith('-'), ctx, [], 'Expected a nonnegative amount');
});
const NonnegativeDecimal = Decimal.superRefine((value, ctx) => {
  invariant(!value.startsWith('-'), ctx, [], 'Expected a nonnegative statistic');
});

const DAY_MS = 86_400_000;

// The UTC day `days` calendar days after `day`. Refinements also see values that failed their
// format checks, so anything but YYYY-MM-DD (e.g. an extended year such as '+275760-09-13', which
// Date.parse accepts but toISOString cannot shift) and any time out of Date's range give null
// instead of throwing; the format issue is already reported.
const addDays = (day: string, days: number): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const time = Date.parse(`${day}T00:00:00Z`) + days * DAY_MS;
  const shifted = new Date(time);
  return Number.isNaN(shifted.getTime()) ? null : shifted.toISOString().slice(0, 10);
};

// An exact decimal string (canon) as an integer number of 10^-scale units; null for anything
// else, so a malformed Amount never reaches BigInt. `scale` must cover its fractional digits.
const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;
const fractionDigits = (value: string): number => DECIMAL.exec(value)?.[3]?.length ?? 0;
const toUnits = (value: string, scale: number): bigint | null => {
  const match = DECIMAL.exec(value);
  if (match === null) return null;
  const [, sign = '', whole = '', fraction = ''] = match;
  if (fraction.length > scale) return null;
  const units = BigInt(whole + fraction.padEnd(scale, '0'));
  return sign === '-' ? -units : units;
};

// A day range of a response: both bounds or neither, from ≤ to. Null bounds mean no common
// coverage and no dates in the request; the listed arrays are then empty.
const rangeIssues = (
  range: { from: string | null; to: string | null },
  arrays: Record<string, readonly unknown[]>,
): Issue[] => {
  if ((range.from === null) !== (range.to === null)) {
    return [{ path: ['to'], message: '`from` and `to` are both null or both set' }];
  }
  if (range.from !== null && range.to !== null) {
    return range.from > range.to ? [{ path: ['from'], message: '`from` is after `to`' }] : [];
  }
  return Object.entries(arrays)
    .filter(([, list]) => list.length > 0)
    .map(([key]) => ({ path: [key], message: 'Expected no items without a day range' }));
};

export const Quality = z.object({
  complete: z.boolean(), // all calculation days are closed
  unreconciledDays: z.array(Day), // calculation days with mismatch in the selected scope
  operationsComplete: z.boolean(), // operation count is defined
  unpairedEvents: Count, // supply logs with op: null over the loaded calculation days
}).superRefine((quality, ctx) => {
  invariant(
    quality.operationsComplete === (quality.complete && quality.unpairedEvents === 0),
    ctx, ['operationsComplete'], 'Operation completeness requires closed days and no unpaired events',
  );
});
export type Quality = z.infer<typeof Quality>;

function isMissingRange(quality: Quality): boolean {
  return !quality.complete && !quality.operationsComplete && quality.unpairedEvents === 0 &&
    quality.unreconciledDays.length === 0;
}

/** One line of a series; `values` holds one value per bucket, null = no data (≠ 0). */
export const SeriesLine = <T extends z.ZodType>(value: T) =>
  z
    .object({
      key: z.string(),
      chain: z.string().optional(),
      flow: z.enum([...FLOWS, 'net', 'turnover']).optional(),
      values: z.array(value.nullable()),
      unreconciled: Indices, // indices into values whose calculation days include a day with mismatch
    })
    .refine((line) => indicesWithin(line.unreconciled, line.values.length), {
      path: ['unreconciled'],
      message: 'Index out of values',
    });
export type SeriesLine<T> = z.infer<ReturnType<typeof SeriesLine<z.ZodType<T>>>>;

const SeriesBase = z.object({
  period: Period,
  buckets: z.array(z.object({ start: Day, end: Day, complete: z.boolean() }).superRefine((bucket, ctx) => {
    invariant(bucket.start <= bucket.end, ctx, ['end'], 'Bucket start is after its end');
  })), // the actual bucket interval
});

const SeriesValues = z.discriminatedUnion('unit', [
  z.object({ unit: z.literal('count'), lines: z.array(SeriesLine(z.int())) }), // negative after `change`
  // Decimal only for rolling_* of the level; every Decimal is also a canonical Amount.
  z.object({ unit: z.literal('tokens'), lines: z.array(SeriesLine(z.union([Amount, Decimal]))) }),
  z.object({ unit: z.enum(['percent', 'percentage_points']), lines: z.array(SeriesLine(Decimal)) }),
]);

// Every line has one value per bucket.
export const Series = z.intersection(SeriesBase, SeriesValues).superRefine((series, ctx) => {
  invariant(series.buckets.length > 0 || series.lines.length === 0, ctx, ['lines'], 'Expected no lines without buckets');
  (series.lines as { values: unknown[] }[]).forEach((line, index) => {
    if (line.values.length !== series.buckets.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['lines', index, 'values'],
        message: `Expected ${series.buckets.length} values, one per bucket`,
      });
    }
  });
});
export type Series = z.infer<typeof Series>;

export const Kpi = z
  .object({
    value: Amount.nullable(),
    changePct: Decimal.nullable(),
    spark: z.array(Amount.nullable()), // the card's formula over header.days
    sparkUnreconciled: Indices,
    quality: Quality, // only value and changePct
  })
  .refine((kpi) => indicesWithin(kpi.sparkUnreconciled, kpi.spark.length), {
    path: ['sparkUnreconciled'],
    message: 'Index out of spark',
  });
export type Kpi = z.infer<typeof Kpi>;

export const Split = z.object({
  quality: Quality,
  volume: z.object({ issuer: NonnegativeAmount.nullable(), bridge: NonnegativeAmount.nullable(), issuerShare: NonnegativeDecimal.nullable() }),
  count: z.object({ issuer: Count.nullable(), bridge: Count.nullable(), issuerShare: NonnegativeDecimal.nullable() }), // bridge — by operations
}).superRefine((split, ctx) => {
  for (const basis of ['volume', 'count'] as const) {
    const values = split[basis];
    const zero = basis === 'volume' ? '0' : 0;
    const unknownBase = values.issuer === null || values.bridge === null;
    const zeroBase = values.issuer === zero && values.bridge === zero;
    invariant(
      (values.issuerShare === null) === (unknownBase || zeroBase),
      ctx, [basis, 'issuerShare'], 'A zero or unknown denominator has no issuer share',
    );
    // 100 × issuer / (issuer + bridge) with nonnegative parts.
    invariant(values.issuerShare === null || Number(values.issuerShare) <= 100,
      ctx, [basis, 'issuerShare'], 'An issuer share is at most 100');
    for (const side of ['issuer', 'bridge'] as const) {
      if (!split.quality.complete) {
        invariant(values[side] === null, ctx, [basis, side], 'A gap makes period sums unknown');
      } else if (basis === 'volume' || side === 'issuer') {
        // Volumes are known even when flagged; an issuer operation is its event.
        invariant(values[side] !== null, ctx, [basis, side], 'Closed days have known volumes and issuer counts');
      } else {
        invariant(!split.quality.operationsComplete || values[side] !== null,
          ctx, [basis, side], 'Complete operations have a known bridge count');
        // The side's quality counts only its flows, and issuer events are never unpaired: on closed
        // days incomplete operations mean an unpaired bridge event (Flows).
        invariant(split.quality.operationsComplete || values[side] === null,
          ctx, [basis, side], 'An unpaired bridge event leaves the bridge count unknown');
      }
    }
  }
});
export type Split = z.infer<typeof Split>;

export const EventRow = z.object({
  id: z.string(),
  chain: z.string(),
  flow: Flow,
  amount: NonnegativeAmount,
  time: IsoDateTime,
  txHash: z.string(),
  explorerUrl: z.url({ protocol: /^https?$/ }), // rendered as a link: no javascript: and the like
  unreconciled: z.boolean(), // the row's day has a mismatch in its chain
  unpaired: z.boolean(), // an event with op: null as a separate row
  bridge: z
    .object({
      version: z.literal([1, 2]),
      peer: z.object({ domain: z.int().nonnegative(), chain: z.string().nullable(), name: z.string() }).nullable(),
    })
    .nullable(),
}).superRefine((row, ctx) => {
  // chain:txHash:logIndex for an issuer or unpaired event, chain:txHash:opLogIndex for a CCTP
  // operation. The DTO carries no log index, so only the prefix is checked: the chain exactly, the
  // transaction hash without case, since ids are ordered by the lowercase hash and fix no case.
  const chainPrefix = `${row.chain}:`;
  invariant(row.id.startsWith(chainPrefix) && row.id.slice(chainPrefix.length).toLowerCase().startsWith(`${row.txHash}:`.toLowerCase()),
    ctx, ['id'], 'An id starts with the chain and transaction of its row');
  const bridgeFlow = row.flow === 'bridge_in' || row.flow === 'bridge_out';
  invariant(bridgeFlow === (row.bridge !== null), ctx, ['bridge'], 'Bridge metadata must match the flow');
  invariant(!row.unpaired || bridgeFlow, ctx, ['unpaired'], 'Only bridge events can be unpaired');
  invariant(!row.unpaired || row.bridge === null || row.bridge.peer === null, ctx, ['bridge', 'peer'], 'An unpaired event has no peer');
});
export type EventRow = z.infer<typeof EventRow>;

const EventsPageShape = z.object({
  from: Day.nullable(),
  to: Day.nullable(),
  quality: Quality,
  items: z.array(EventRow),
  nextCursor: z.string().min(1).nullable(),
});

const eventsPageRange = (page: z.infer<typeof EventsPageShape>, ctx: z.RefinementCtx): void => {
  for (const issue of rangeIssues(page, { items: page.items })) ctx.addIssue({ code: 'custom', ...issue });
  if (page.from === null && page.to === null) {
    invariant(isMissingRange(page.quality), ctx, ['quality'], 'Expected missing-range quality without coverage');
    invariant(page.nextCursor === null, ctx, ['nextCursor'], 'No cursor exists without a day range');
  }
  if (page.from !== null && page.to !== null && page.from <= page.to) {
    page.items.forEach((item, index) => {
      const day = item.time.slice(0, 10);
      invariant(day >= page.from! && day <= page.to!, ctx, ['items', index, 'time'], 'Event is outside the requested day range');
      // The row's chain is selected and its day is a calculation day of the page's quality.
      invariant(!item.unreconciled || page.quality.unreconciledDays.includes(day),
        ctx, ['items', index, 'unreconciled'], 'A mismatched row day is an unreconciled day of the page');
    });
    page.quality.unreconciledDays.forEach((day, index) => {
      invariant(day >= page.from! && day <= page.to!, ctx, ['quality', 'unreconciledDays', index], 'An unreconciled day is outside the page range');
    });
  }
  // The page is a part of the range its quality describes.
  invariant(page.items.filter((item) => item.unpaired).length <= page.quality.unpairedEvents,
    ctx, ['quality', 'unpairedEvents'], 'Unpaired rows are counted by the page quality');
};

export const EventsPage = EventsPageShape.superRefine(eventsPageRange);
export type EventsPage = z.infer<typeof EventsPage>;

const EVENTS_STATS_BUCKETS = 5; // [0, 10k), [10k, 100k), [100k, 1M), [1M, 10M), [10M, ∞) in tokens
const SIZE_BOUNDS = ['0', '10000', '100000', '1000000', '10000000'] as const;

// `buckets` is never null: empty without a day range, otherwise all five, with null `ops` and
// `amount` when a day is missing or the operation count is undefined.
export const EventsStats = z
  .object({
    from: Day.nullable(),
    to: Day.nullable(),
    quality: Quality,
    byFlow: z.array(
      z.object({ flow: Flow, events: Count.nullable(), ops: Count.nullable(), amount: NonnegativeAmount.nullable(), mean: NonnegativeDecimal.nullable() }),
    ),
    buckets: z.array(z.object({ min: NonnegativeAmount, max: NonnegativeAmount.nullable(), ops: Count.nullable(), amount: NonnegativeAmount.nullable() })),
  })
  .superRefine((stats, ctx) => {
    const issues = rangeIssues(stats, { byFlow: stats.byFlow, buckets: stats.buckets });
    if (stats.from !== null && stats.to !== null && stats.buckets.length !== EVENTS_STATS_BUCKETS) {
      issues.push({ path: ['buckets'], message: `Expected ${EVENTS_STATS_BUCKETS} buckets` });
    }
    for (const issue of issues) ctx.addIssue({ code: 'custom', ...issue });
    if (stats.from === null && stats.to === null) {
      invariant(isMissingRange(stats.quality), ctx, ['quality'], 'Expected missing-range quality without coverage');
      return;
    }
    stats.byFlow.forEach((flow, index) => {
      if (!stats.quality.complete) {
        for (const field of ['events', 'ops', 'amount', 'mean'] as const) {
          invariant(flow[field] === null, ctx, ['byFlow', index, field], 'A gap makes every flow aggregate unknown');
        }
      } else {
        for (const field of ['events', 'amount'] as const) {
          invariant(flow[field] !== null, ctx, ['byFlow', index, field], 'Closed days have known events and volume');
        }
        invariant(!stats.quality.operationsComplete || flow.ops !== null, ctx, ['byFlow', index, 'ops'], 'Complete operations have a known count');
        invariant(!flow.flow.startsWith('issuer_') || flow.ops !== null, ctx, ['byFlow', index, 'ops'], 'Closed issuer events have a known operation count');
      }
      if (stats.quality.complete) {
        invariant((flow.mean === null) === (flow.ops === null || flow.ops === 0 || flow.amount === null), ctx, ['byFlow', index, 'mean'], 'An unknown or zero operation count has no mean');
      }
      if (flow.events === 0 && flow.amount !== null) {
        invariant(flow.amount === '0', ctx, ['byFlow', index, 'amount'], 'A flow without supply events has no volume');
      }
      if (flow.events !== null && flow.ops !== null) {
        invariant(flow.ops <= flow.events, ctx, ['byFlow', index, 'ops'], 'Operations cannot outnumber supply events');
        // With known grouping each supply event belongs to exactly one operation.
        invariant(flow.events === 0 || flow.ops > 0, ctx, ['byFlow', index, 'ops'], 'Supply events form at least one operation');
        const issuer = flow.flow === 'issuer_mint' || flow.flow === 'issuer_burn';
        invariant(!issuer || flow.ops === flow.events, ctx, ['byFlow', index, 'ops'], 'Issuer operations are individual events');
      }
    });
    stats.buckets.forEach((bucket, index) => {
      if (stats.buckets.length === EVENTS_STATS_BUCKETS) {
        invariant(bucket.min === SIZE_BOUNDS[index], ctx, ['buckets', index, 'min'], 'Unexpected size bucket minimum');
        invariant(bucket.max === (SIZE_BOUNDS[index + 1] ?? null), ctx, ['buckets', index, 'max'], 'Unexpected size bucket maximum');
      }
      for (const field of ['ops', 'amount'] as const) {
        invariant(
          stats.quality.operationsComplete ? bucket[field] !== null : bucket[field] === null,
          ctx, ['buckets', index, field], 'Size aggregates require complete operation grouping',
        );
      }
      const lower = SIZE_BOUNDS[index];
      if (stats.buckets.length === EVENTS_STATS_BUCKETS && lower !== undefined && bucket.ops !== null &&
        Number.isSafeInteger(bucket.ops) && bucket.amount !== null) {
        // n operations of [min, max) each sum to [min × n, max × n); none sum to zero. The fixed
        // bounds are used, so a wrong bound is reported once, above.
        const upper = SIZE_BOUNDS[index + 1];
        const scale = fractionDigits(bucket.amount);
        const amount = toUnits(bucket.amount, scale);
        const min = toUnits(lower, scale);
        const max = upper === undefined ? null : toUnits(upper, scale);
        const n = BigInt(bucket.ops);
        if (amount !== null && min !== null) {
          invariant(bucket.ops > 0 || amount === 0n, ctx, ['buckets', index, 'amount'], 'A bucket without operations has no volume');
          invariant(bucket.ops === 0 || amount >= min * n, ctx, ['buckets', index, 'amount'], 'Bucket volume is below its operations minimum');
          invariant(bucket.ops === 0 || max === null || amount < max * n,
            ctx, ['buckets', index, 'amount'], 'Bucket volume reaches its operations maximum');
        }
      }
    });
  });
export type EventsStats = z.infer<typeof EventsStats>;

export const RecordItem = z.object({
  kind: z.enum(['max_supply', 'max_issuer_mint_day', 'max_issuer_burn_day', 'largest_event']),
  scope: z.string(), // chain slug or 'all'
  value: NonnegativeAmount.nullable(),
  day: Day.nullable(),
  since: Day,
  quality: Quality,
  event: EventRow.optional(),
}).superRefine((record, ctx) => {
  invariant((record.value === null) === (record.day === null), ctx, ['day'], 'A record has both a value and a day, or neither');
  invariant(record.day === null || record.day >= record.since, ctx, ['day'], 'Record day precedes its search range');
  if (record.event !== undefined && record.scope !== 'all') {
    invariant(record.event.chain === record.scope, ctx, ['event', 'chain'], 'A chain record has an operation of that chain');
  }
  if (record.kind === 'largest_event') {
    invariant(record.quality.operationsComplete || record.value === null, ctx, ['value'], 'Undefined grouping has no largest operation');
    if (record.event !== undefined) {
      invariant(record.value === record.event.amount, ctx, ['event', 'amount'], 'Record value differs from its operation');
      invariant(record.day === record.event.time.slice(0, 10), ctx, ['event', 'time'], 'Record day differs from its operation');
    }
  }
});
export type RecordItem = z.infer<typeof RecordItem>;

const DELAY_HOURS = 30; // from 00:00 UTC of lastClosedDay + 1 to 06:00 UTC of lastClosedDay + 2

export const ChainStatus = z.object({
  chain: z.string(),
  state: z.enum(['ok', 'delayed', 'unreconciled', 'no_data']),
  historyStart: Day.nullable(),
  lastClosedDay: Day.nullable(),
  lastBlock: BlockNumber.nullable(),
  nextDueAt: IsoDateTime.nullable(),
  lagHours: z.int().nullable(),
  lastRun: z
    .object({ finishedAt: IsoDateTime, status: z.enum(['ok', 'partial', 'failed']), toBlock: BlockNumber.nullable() })
    .nullable(),
  reconciliation: z
    .object({
      day: Day,
      supply: z.enum(['ok', 'mismatch']),
      supplyDiff: Amount,
      bridge: z.enum(['ok', 'mismatch']),
      continuity: z.enum(['ok', 'mismatch', 'none']),
    })
    .nullable(),
  unreconciledDays: z.array(Day),
}).superRefine((status, ctx) => {
  if (status.state === 'no_data') {
    for (const field of ['historyStart', 'lastClosedDay', 'lastBlock', 'nextDueAt', 'lagHours', 'reconciliation'] as const) {
      invariant(status[field] === null, ctx, [field], 'A chain without closed days has no coverage or reconciliation');
    }
    invariant(status.unreconciledDays.length === 0, ctx, ['unreconciledDays'], 'A chain without closed days has no mismatched days');
  } else {
    for (const field of ['historyStart', 'lastClosedDay', 'lastBlock', 'nextDueAt', 'lagHours', 'reconciliation'] as const) {
      invariant(status[field] !== null, ctx, [field], 'A chain with data has coverage and its last-day reconciliation');
    }
  }
  invariant(status.historyStart === null || status.lastClosedDay === null || status.historyStart <= status.lastClosedDay,
    ctx, ['historyStart'], 'History starts after the last closed day');
  if (status.lastClosedDay !== null && status.nextDueAt !== null) {
    const due = addDays(status.lastClosedDay, 2);
    invariant(due === null || Date.parse(status.nextDueAt) === Date.parse(`${due}T06:00:00Z`),
      ctx, ['nextDueAt'], 'The next day is due at 06:00 UTC of lastClosedDay + 2');
  }
  if (status.lagHours !== null) {
    invariant(status.lagHours >= 0, ctx, ['lagHours'], 'Lag hours cannot be negative');
    // lagHours counts full hours from 00:00 UTC of lastClosedDay + 1, and nextDueAt is 30 hours
    // after that moment, so `now ≥ nextDueAt` holds exactly when lagHours ≥ 30.
    if (status.state !== 'no_data') {
      invariant((status.state === 'delayed') === (status.lagHours >= DELAY_HOURS),
        ctx, ['state'], 'A chain is delayed exactly when its lag reaches 30 hours');
    }
  }
  if (status.reconciliation !== null) {
    const recon = status.reconciliation;
    invariant(recon.day === status.lastClosedDay, ctx, ['reconciliation', 'day'], 'Reconciliation must describe the last closed day');
    invariant((recon.supply === 'ok') === (recon.supplyDiff === '0'), ctx, ['reconciliation', 'supplyDiff'], 'Supply status must match its exact difference');
    const mismatch = recon.supply === 'mismatch' || recon.bridge === 'mismatch' || recon.continuity === 'mismatch';
    invariant(status.state !== 'ok' || !mismatch, ctx, ['state'], 'A current mismatched day is not ok');
    invariant(status.state !== 'unreconciled' || mismatch, ctx, ['state'], 'Unreconciled state requires a last-day mismatch');
  }
});
export type ChainStatus = z.infer<typeof ChainStatus>;

// One public driver per scope: four flow sums and net, plus supply-log counts over each
// actual bucket interval. No data, closed zero-event intervals and zero-amount logs are distinct.
const DRIVER_LINES = [...FLOWS, 'net'] as const;

function driverIssues(driver: { series: Series; events: (number | null)[] }, ctx: z.RefinementCtx): void {
  const { series, events } = driver;
  invariant(series.unit === 'tokens', ctx, ['series', 'unit'], 'A driver series is in tokens');
  const lines = series.lines as { key: string; flow?: string; values: (string | number | null)[] }[];
  const canonical = lines.length === DRIVER_LINES.length &&
    DRIVER_LINES.every((flow, index) => lines[index]?.key === flow && lines[index]?.flow === flow);
  invariant(canonical, ctx, ['series', 'lines'], 'A driver series has the four flows and net in order');
  invariant(events.length === series.buckets.length, ctx, ['events'], `Expected ${series.buckets.length} events, one per bucket`);
  if (!canonical || events.length !== series.buckets.length) return;
  if (lines.some((line) => line.values.length !== events.length)) return; // reported by Series
  events.forEach((count, index) => {
    const values = lines.map((line) => line.values[index] ?? null);
    const known = values.filter((value) => value !== null).length;
    const uniform = known === 0 || known === values.length;
    invariant(uniform, ctx, ['events', index], 'The flows and net of a day are all known or all null');
    if (uniform) {
      invariant((count === null) === (known === 0), ctx, ['events', index], 'Events are null exactly where the day is not known');
    }
    const flows = values.slice(0, FLOWS.length);
    invariant(count !== 0 || flows.every((value) => value === null || value === '0'),
      ctx, ['events', index], 'A nonzero flow needs at least one event');
  });
}

const HEADER_CARDS = ['supply', 'change1d', 'change7d', 'issuerMinted7d', 'issuerBurned7d'] as const;

export const OverviewDriver = z.object({ scope: z.string(), series: Series, events: z.array(Count.nullable()) }).superRefine(driverIssues);
export const OverviewView = z.object({
  noDataChains: z.array(z.array(z.string())).optional(), // aligned bucket lists, in enabled-chain order
  from: Day,
  to: Day,
  period: z.enum(['day', 'week', 'month']),
  supplyByChain: z.object({ level: Series, share: Series, total: Series, stackedLevel: Series, stackedShare: Series }),
  drivers: z.array(OverviewDriver),
  issuerVsBridge: z.array(z.object({ scope: z.string(), in: Split, out: Split })),
});
export type OverviewView = z.infer<typeof OverviewView>;
export const OverviewDay = z.object({
  date: Day,
  rows: z.array(z.object({
    scope: z.string(),
    values: z.object({ issuer_mint: NonnegativeAmount.nullable(), issuer_burn: NonnegativeAmount.nullable(), bridge_in: NonnegativeAmount.nullable(), bridge_out: NonnegativeAmount.nullable(), net: Amount.nullable() }),
    events: Count.nullable(),
    unreconciled: z.boolean(),
  })),
});
export type OverviewDay = z.infer<typeof OverviewDay>;

const OverviewShape = z
  .object({
    asset: z.string(),
    generatedAt: IsoDateTime,
    asOf: Day.nullable(),
    historyStart: Day.nullable(),
    chains: z.array(z.object({ slug: z.string(), name: z.string(), explorerTx: z.string() })), // enabled chains
    header: z.object({
      days: z.array(Day),
      supply: Kpi,
      change1d: Kpi,
      change7d: Kpi,
      issuerMinted7d: Kpi,
      issuerBurned7d: Kpi,
    }), // 1
    views: z.strictObject({ '30d': OverviewView.nullable(), '90d': OverviewView.nullable(), all: OverviewView.nullable() }),
    day: OverviewDay.nullable(),
    largestEvents: EventsPageShape.extend({ nextCursor: z.null() }).superRefine(eventsPageRange), // 5; no paging in overview
    records: z.array(RecordItem), // 6
    status: z.object({ chains: z.array(ChainStatus) }), // 7
  });
type OverviewShape = z.infer<typeof OverviewShape>;

// Chart 7 (accepted by the owner after review): one status per enabled chain (`chains`), no
// other chains. A missing status is reported on the list, a duplicate or foreign one on its entry.
function statusListIssues(overview: OverviewShape, ctx: z.RefinementCtx): boolean {
  const enabled = new Set<string>();
  overview.chains.forEach((chain, index) => {
    invariant(!enabled.has(chain.slug), ctx, ['chains', index, 'slug'], 'An enabled chain is listed once');
    enabled.add(chain.slug);
  });
  const seen = new Set<string>();
  let valid = true;
  overview.status.chains.forEach((status, index) => {
    const known = enabled.has(status.chain);
    const repeated = seen.has(status.chain);
    seen.add(status.chain);
    valid &&= known && !repeated;
    invariant(known, ctx, ['status', 'chains', index, 'chain'], 'A status describes an enabled chain');
    invariant(!repeated, ctx, ['status', 'chains', index, 'chain'], 'An enabled chain has one status');
  });
  const complete = [...enabled].every((slug) => seen.has(slug));
  invariant(complete, ctx, ['status', 'chains'], 'Every enabled chain has a status');
  return valid && complete;
}

// Common coverage: historyStart is the latest first closed day of the enabled chains and asOf
// the earliest last closed day; an enabled chain without closed days or disjoint intervals leave both
// null. `status.chains` holds exactly the enabled chains here.
function coverageIssues(overview: OverviewShape, ctx: z.RefinementCtx): boolean {
  const statuses = overview.status.chains;
  if (statuses.length === 0) return true; // no enabled chains: there is no common coverage
  const closed = statuses.flatMap((status) =>
    status.historyStart === null || status.lastClosedDay === null ? [] : [{ first: status.historyStart, last: status.lastClosedDay }]);
  const first = closed.reduce<string | null>((max, chain) => (max === null || chain.first > max ? chain.first : max), null);
  const last = closed.reduce<string | null>((min, chain) => (min === null || chain.last < min ? chain.last : min), null);
  const common = closed.length === statuses.length && first !== null && last !== null && first <= last;
  invariant(overview.asOf === (common ? last : null), ctx, ['asOf'], 'asOf is the earliest last closed day of the enabled chains');
  invariant(overview.historyStart === (common ? first : null),
    ctx, ['historyStart'], 'historyStart is the latest first closed day of the enabled chains');
  return overview.asOf === (common ? last : null) && overview.historyStart === (common ? first : null);
}

// Feed and records keep their own ranges, independently of the three public views.
function viewRangeIssues(overview: OverviewShape, historyStart: string, asOf: string, ctx: z.RefinementCtx): void {
  const week = addDays(asOf, -6);
  const scopes = ['all', ...overview.chains.map((chain) => chain.slug)];
  invariant(overview.largestEvents.from === week, ctx, ['largestEvents', 'from'], 'The feed starts seven days before asOf');
  invariant(overview.largestEvents.to === asOf, ctx, ['largestEvents', 'to'], 'The feed ends at asOf');
  overview.records.forEach((record, index) => {
    invariant(record.since === historyStart, ctx, ['records', index, 'since'], 'Records are searched from historyStart');
    invariant(record.day === null || record.day <= asOf, ctx, ['records', index, 'day'], 'Records are searched up to asOf');
    invariant(scopes.includes(record.scope), ctx, ['records', index, 'scope'], "A record scope is 'all' or an enabled chain");
  });
}

// Each spark has one point per header day.
export const Overview = OverviewShape.superRefine((overview, ctx) => {
  invariant((overview.asOf === null) === (overview.historyStart === null), ctx, ['historyStart'], 'Common coverage has both dates or neither');
  invariant(overview.asOf === null || overview.historyStart === null || overview.historyStart <= overview.asOf,
    ctx, ['historyStart'], 'Common history starts after asOf');
  if (overview.asOf === null) {
    invariant(overview.header.days.length === 0, ctx, ['header', 'days'], 'No header days without common coverage');
    for (const card of HEADER_CARDS) {
      const kpi = overview.header[card];
      for (const field of ['value', 'changePct'] as const) {
        invariant(kpi[field] === null, ctx, ['header', card, field], 'No card value without common coverage');
      }
      invariant(kpi.spark.length === 0, ctx, ['header', card, 'spark'], 'No spark without common coverage');
      invariant(isMissingRange(kpi.quality), ctx, ['header', card, 'quality'], 'Expected missing-range card quality');
    }
    invariant(overview.records.length === 0, ctx, ['records'], 'No records without common coverage');
    invariant(overview.largestEvents.from === null && overview.largestEvents.to === null,
      ctx, ['largestEvents', 'from'], 'No feed range without common coverage');
  }
  // Without enabled chains there is no common coverage.
  invariant(overview.chains.length > 0 || overview.asOf === null, ctx, ['asOf'], 'No common coverage without enabled chains');
  if (overview.asOf !== null) {
    const asOf = overview.asOf;
    // Every enabled chain is closed on asOf, so S(asOf) is known.
    invariant(overview.header.supply.value !== null, ctx, ['header', 'supply', 'value'], 'The supply card has a value on asOf');
    for (const card of HEADER_CARDS) {
      // Each spark repeats its card's formula by day; its last day is asOf.
      const { spark, value } = overview.header[card];
      if (spark.length > 0) {
        invariant(spark[spark.length - 1] === value, ctx, ['header', card, 'spark', spark.length - 1], 'The last spark point is the card value');
      }
    }
    // The chain starting at historyStart has no earlier day, so a feed window before it has a gap.
    const feedFrom = overview.largestEvents.from;
    invariant(feedFrom === null || overview.historyStart === null || feedFrom >= overview.historyStart || !overview.largestEvents.quality.complete,
      ctx, ['largestEvents', 'quality', 'complete'], 'A feed window before historyStart is incomplete');
    invariant(overview.header.days.length === 30 && overview.header.days.every((day, index) => day === addDays(asOf, index - 29)),
      ctx, ['header', 'days'], 'Header days are the thirty UTC days ending at asOf');
  }
  const datesConsistent = (overview.asOf === null) === (overview.historyStart === null) &&
    (overview.asOf === null || overview.historyStart === null || overview.historyStart <= overview.asOf);
  const statusesMatch = statusListIssues(overview, ctx);
  if (datesConsistent) {
    if (statusesMatch && coverageIssues(overview, ctx)) overviewViewsIssues(overview, ctx);
    if (overview.asOf !== null && overview.historyStart !== null) {
      viewRangeIssues(overview, overview.historyStart, overview.asOf, ctx);
    }
  }
  invariant(overview.header.supply.changePct === null, ctx, ['header', 'supply', 'changePct'], 'Supply card has no percentage change');
  for (const card of HEADER_CARDS) {
    if (overview.header[card].spark.length !== overview.header.days.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['header', card, 'spark'],
        message: `Expected ${overview.header.days.length} points, one per header day`,
      });
    }
  }
});
export type Overview = z.infer<typeof Overview>;

export const ApiErrorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export const Health = z.object({ status: z.literal('ok') });
export type Health = z.infer<typeof Health>;
