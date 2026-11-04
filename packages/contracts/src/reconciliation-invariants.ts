import type { z } from 'zod';
import type { Overview } from './schemas.ts';

const distance = (from: string, to: string): number =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

/** Summary counts describe retained chain-days, distinct from the latest-day status checks. */
export function reconciliationIssues(overview: Overview, ctx: z.RefinementCtx): void {
  const { all, chains, reconciledChains } = overview.reconciliation;
  const check = (valid: boolean, path: PropertyKey[], message: string): void => {
    if (!valid) ctx.addIssue({ code: 'custom', path: ['reconciliation', ...path], message });
  };
  check(chains.length === overview.chains.length, ['chains'], 'Every enabled chain has one summary');
  chains.forEach((summary, index) => {
    const path = ['chains', index];
    check(summary.chain === overview.chains[index]?.slug, [...path, 'chain'], 'Summaries follow enabled chain order');
    const status = overview.status.chains.find((status) => status.chain === summary.chain);
    if (status === undefined) return;
    check(summary.streakEnd === status.lastClosedDay, [...path, 'streakEnd'], 'The chain streak ends at its last closed day');
    check(summary.mismatchedDays === status.unreconciledDays.length, [...path, 'mismatchedDays'], 'Count every mismatched retained day once');
    if (status.historyStart === null || status.lastClosedDay === null) {
      for (const key of ['closedDays', 'events', 'mismatchedDays', 'streakDays'] as const) {
        check(summary[key] === 0, [...path, key], 'A chain without closed history has zero counters');
      }
      return;
    }
    const span = distance(status.historyStart, status.lastClosedDay) + 1;
    check(summary.closedDays > 0 && summary.closedDays <= span, [...path, 'closedDays'], 'Closed rows fit the retained calendar span');
    const lastMismatch = status.unreconciledDays.at(-1);
    const suffix = lastMismatch === undefined ? span : distance(lastMismatch, status.lastClosedDay);
    check(summary.streakDays <= suffix, [...path, 'streakDays'], 'A streak cannot cross a mismatch');
    check((summary.streakDays === 0) === (lastMismatch === status.lastClosedDay), [...path, 'streakDays'], 'A clean last closed day has a positive streak');
    if (summary.closedDays === span) {
      check(summary.streakDays === suffix, [...path, 'streakDays'], 'A gap-free history has the complete clean suffix');
    }
  });
  for (const key of ['closedDays', 'events', 'mismatchedDays'] as const) {
    // BigInt also keeps this check exact when individually valid chain counts sum beyond Count.
    if (Number.isSafeInteger(all[key]) && chains.every((chain) => Number.isSafeInteger(chain[key]))) {
      check(BigInt(all[key]) === chains.reduce((sum, chain) => sum + BigInt(chain[key]), 0n), ['all', key], 'The scope count sums chain counters');
    }
  }
  const latestOk = overview.status.chains.filter(({ reconciliation }) =>
    reconciliation?.supply === 'ok' && reconciliation.bridge === 'ok' && reconciliation.continuity === 'ok').length;
  check(reconciledChains === latestOk, ['reconciledChains'], 'Count chains with all latest-day checks ok');
  check(all.streakEnd === overview.asOf, ['all', 'streakEnd'], 'The scope streak ends at the common asOf');
  if (overview.asOf === null || overview.historyStart === null) {
    check(all.streakDays === 0, ['all', 'streakDays'], 'No common streak without common coverage');
    return;
  }
  const span = distance(overview.historyStart, overview.asOf) + 1;
  const mismatches = overview.status.chains.flatMap((status) => status.unreconciledDays)
    .filter((day) => day >= overview.historyStart! && day <= overview.asOf!).sort();
  const lastMismatch = mismatches.at(-1);
  const suffix = lastMismatch === undefined ? span : distance(lastMismatch, overview.asOf);
  check(all.streakDays <= suffix, ['all', 'streakDays'], 'The common streak stays within coverage and after mismatches');
  for (const chain of chains) {
    if (chain.streakEnd === all.streakEnd) {
      check(all.streakDays <= chain.streakDays, ['all', 'streakDays'], 'The common streak fits every chain suffix at the same endpoint');
    }
  }
  const gapFree = chains.length > 0 && chains.every((chain) => {
    const status = overview.status.chains.find((status) => status.chain === chain.chain);
    return status?.historyStart !== null && status?.historyStart !== undefined && status.lastClosedDay !== null &&
      chain.closedDays === distance(status.historyStart, status.lastClosedDay) + 1;
  });
  if (gapFree) check(all.streakDays === suffix, ['all', 'streakDays'], 'Gap-free scope has the complete common suffix');
}
