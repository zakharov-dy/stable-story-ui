import { expect, it } from 'vitest';
import { createMockClient } from './mock.ts';
import { Overview, ReconciliationSummary } from './schemas.ts';
import type { Overview as Document } from './schemas.ts';
import { coveredOverview, emptyOverview } from './schemas.invariants.fixtures.ts';

const document = (): Document => Overview.parse(structuredClone(coveredOverview));

it('requires the summary on overview', () => {
  const input = Object.fromEntries(Object.entries(coveredOverview).filter(([key]) => key !== 'reconciliation'));
  const result = Overview.safeParse(input);
  expect(result.success).toBe(false);
  expect(result.error?.issues.map((issue) => issue.path)).toContainEqual(['reconciliation']);
});

it.each([
  { label: 'fractional count', path: 'closedDays', change: { closedDays: 1.5 } },
  { label: 'unsafe integer', path: 'events', change: { events: Number.MAX_SAFE_INTEGER + 1 } },
  { label: 'negative count', path: 'mismatchedDays', change: { mismatchedDays: -1 } },
  { label: 'more mismatches than closed days', path: 'mismatchedDays', change: { mismatchedDays: 7 } },
  { label: 'streak crosses a mismatched day', path: 'streakDays', change: { mismatchedDays: 1, streakDays: 6 } },
  { label: 'events without closed days', path: 'events', change: { closedDays: 0, streakDays: 0, events: 1 } },
])('rejects $label at its counter path', ({ path, change }) => {
  const result = ReconciliationSummary.safeParse({ closedDays: 6, events: 0, mismatchedDays: 0, streakDays: 6, streakEnd: '2026-10-06', ...change });
  expect(result.success).toBe(false);
  expect(result.error?.issues.map((issue) => issue.path)).toContainEqual([path]);
});

it.each<{ label: string; path: string; mutate: (input: Document) => void }>([
  { label: 'missing chain', path: 'chains', mutate: (d) => { d.reconciliation.chains = []; } },
  { label: 'foreign chain', path: 'chains.0.chain', mutate: (d) => { d.reconciliation.chains[0].chain = 'other'; } },
  { label: 'wrong closed-day sum', path: 'all.closedDays', mutate: (d) => { d.reconciliation.all.closedDays++; } },
  { label: 'wrong event sum', path: 'all.events', mutate: (d) => { d.reconciliation.all.events++; } },
  { label: 'wrong mismatch sum', path: 'all.mismatchedDays', mutate: (d) => { d.reconciliation.all.mismatchedDays = 1; d.reconciliation.all.streakDays = 0; } },
  { label: 'wrong mismatch status count', path: 'chains.0.mismatchedDays', mutate: (d) => { d.reconciliation.chains[0].mismatchedDays = 1; d.reconciliation.chains[0].streakDays = 0; } },
  { label: 'wrong latest all-ok count', path: 'reconciledChains', mutate: (d) => { d.reconciliation.reconciledChains = 1; } },
  { label: 'wrong chain endpoint', path: 'chains.0.streakEnd', mutate: (d) => { d.reconciliation.chains[0].streakEnd = null; } },
  { label: 'wrong common endpoint', path: 'all.streakEnd', mutate: (d) => { d.reconciliation.all.streakEnd = null; } },
  { label: 'too many closed days', path: 'chains.0.closedDays', mutate: (d) => { d.reconciliation.chains[0].closedDays = 7; } },
  { label: 'no closed rows despite coverage', path: 'chains.0.closedDays', mutate: (d) => { d.reconciliation.chains[0].closedDays = 0; d.reconciliation.chains[0].streakDays = 0; } },
  { label: 'zero suffix at clean latest day', path: 'chains.0.streakDays', mutate: (d) => { d.reconciliation.chains[0].streakDays = 0; } },
  { label: 'short gap-free suffix', path: 'chains.0.streakDays', mutate: (d) => { d.reconciliation.chains[0].streakDays = 5; } },
  { label: 'short gap-free common suffix', path: 'all.streakDays', mutate: (d) => { d.reconciliation.all.streakDays = 5; } },
])('rejects $label on its specific summary path', ({ path, mutate }) => {
  const input = document();
  mutate(input);
  const result = Overview.safeParse(input);
  expect(result.success).toBe(false);
  expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(`reconciliation.${path}`);
});

it('validates chain order and duplicates independently of the status order', async () => {
  const input = await createMockClient('ok').overview();
  const result = Overview.safeParse({ ...input, reconciliation: { ...input.reconciliation, chains: [...input.reconciliation.chains].reverse() } });
  expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('reconciliation.chains.0.chain');
  const duplicate = structuredClone(input);
  duplicate.reconciliation.chains[1] = duplicate.reconciliation.chains[0]!;
  expect(Overview.safeParse(duplicate).error?.issues.map((issue) => issue.path.join('.'))).toContain('reconciliation.chains.1.chain');
});

it('rejects a positive suffix at a mismatched latest day', async () => {
  const input = await createMockClient('unreconciled').overview();
  const chain = input.reconciliation.chains.findIndex((chain) => chain.chain === 'ethereum');
  input.reconciliation.chains[chain].streakDays = 1;
  input.reconciliation.all.streakDays = 1;
  const result = Overview.safeParse(input);
  expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(expect.arrayContaining([
    `reconciliation.chains.${chain}.streakDays`, 'reconciliation.all.streakDays',
  ]));
});

it('allows gapped histories but bounds the common suffix by a chain at the same endpoint', () => {
  const input = document();
  input.reconciliation.all.closedDays = 4;
  input.reconciliation.all.streakDays = 2;
  input.reconciliation.chains[0].closedDays = 4;
  input.reconciliation.chains[0].streakDays = 2;
  expect(Overview.safeParse(input).success).toBe(true);
  input.reconciliation.all.streakDays = 3;
  expect(Overview.safeParse(input).error?.issues.map((issue) => issue.path.join('.'))).toContain('reconciliation.all.streakDays');
});

it('keeps no-data counters zero and the common endpoint null', () => {
  expect(Overview.safeParse(emptyOverview).success).toBe(true);
  const input = structuredClone(emptyOverview);
  input.reconciliation.chains[0].closedDays = 1;
  input.reconciliation.all.closedDays = 1;
  input.reconciliation.all.streakDays = 1;
  const result = Overview.safeParse(input);
  expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(expect.arrayContaining([
    'reconciliation.chains.0.closedDays', 'reconciliation.all.streakDays',
  ]));
});

it('accepts old mismatches with a clean latest day and rejects suffixes crossing the old failure', () => {
  const input = document();
  input.status.chains[0].unreconciledDays = ['2026-10-02'];
  input.status.chains[0].reconciliation!.continuity = 'ok';
  input.reconciliation.reconciledChains = 1;
  input.reconciliation.all.mismatchedDays = 1;
  input.reconciliation.all.streakDays = 4;
  input.reconciliation.chains[0].mismatchedDays = 1;
  input.reconciliation.chains[0].streakDays = 4;
  // Existing chart flags also describe this historical mismatch.
  for (const view of Object.values(input.views)) {
    if (view === null) continue;
    const series = [...Object.values(view.supplyByChain), ...view.drivers.map((driver) => driver.series)];
    for (const item of series) for (const line of item.lines) {
      line.unreconciled = item.buckets.flatMap((bucket, index) => bucket.start <= '2026-10-02' && bucket.end >= '2026-10-02' ? [index] : []);
    }
    for (const split of view.issuerVsBridge) {
      split.in.quality.unreconciledDays = ['2026-10-02'];
      split.out.quality.unreconciledDays = ['2026-10-02'];
    }
  }
  expect(Overview.safeParse(input).success).toBe(true);
  input.reconciliation.chains[0].streakDays = 5;
  input.reconciliation.all.streakDays = 5;
  const result = Overview.safeParse(input);
  expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(expect.arrayContaining([
    'reconciliation.chains.0.streakDays', 'reconciliation.all.streakDays',
  ]));
});
