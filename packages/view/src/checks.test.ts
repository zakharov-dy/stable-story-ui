import type { ChainStatus } from '@app/contracts';
import { describe, expect, it } from 'vitest';
import { affectedTerms, checkChips, type CheckKind } from './checks.ts';

type Reconciliation = NonNullable<ChainStatus['reconciliation']>;

const D = '2026-10-09';
const ok: Reconciliation = { day: D, supply: 'ok', supplyDiff: '0', bridge: 'ok', continuity: 'ok' };
const run = (patch: Partial<Reconciliation> | null, unreconciledDays: string[] = [], figuresKnown = true) =>
  checkChips({ asOf: D, reconciliation: patch === null ? null : { ...ok, ...patch }, unreconciledDays, figuresKnown });
const kinds = (patch: Partial<Reconciliation> | null, unreconciledDays: string[] = []): CheckKind[] =>
  run(patch, unreconciledDays)?.chips.map((chip) => chip.kind) ?? [];

describe('checkChips, the chain closed the day shown (R.day = D)', () => {
  it('passes when every check is ok', () => {
    expect(run({})).toEqual({ reconciliationDay: D, later: false, chips: [{ kind: 'passed', tone: 'ok' }] });
  });

  it('names a supply mismatch with its exact difference', () => {
    expect(run({ supply: 'mismatch', supplyDiff: '-12.40' })?.chips).toEqual([{ kind: 'supply', tone: 'bad', supplyDiff: '-12.40' }]);
  });

  it('names a bridge mismatch', () => {
    expect(run({ bridge: 'mismatch' })?.chips).toEqual([{ kind: 'bridge', tone: 'bad' }]);
  });

  it('names a continuity mismatch', () => {
    expect(run({ continuity: 'mismatch' })?.chips).toEqual([{ kind: 'continuity', tone: 'bad' }]);
  });

  it('gives one chip per failed check, not a single summary', () => {
    expect(kinds({ supply: 'mismatch', supplyDiff: '5', bridge: 'mismatch', continuity: 'mismatch' })).toEqual(['supply', 'bridge', 'continuity']);
    expect(kinds({ supply: 'mismatch', supplyDiff: '5', continuity: 'mismatch' })).toEqual(['supply', 'continuity']);
    expect(kinds({ bridge: 'mismatch', continuity: 'mismatch' })).toEqual(['bridge', 'continuity']);
  });

  it('shows a first day (no continuity) as a muted chip next to "checks passed", not as a failure', () => {
    expect(run({ continuity: 'none' })?.chips).toEqual([
      { kind: 'passed', tone: 'ok' },
      { kind: 'continuityFirst', tone: 'muted' },
    ]);
  });

  it('keeps the muted continuity chip next to a failure, without "checks passed"', () => {
    expect(kinds({ continuity: 'none', bridge: 'mismatch' })).toEqual(['bridge', 'continuityFirst']);
  });

  it('is not changed by the flagged days list (the checks themselves decide)', () => {
    expect(kinds({}, [D])).toEqual(['passed']);
  });
});

describe('checkChips, the chain closed a later day (R.day > D)', () => {
  const later = '2026-10-10';

  it('flags the day shown when it is in unreconciledDays', () => {
    expect(run({ day: later }, [D])).toEqual({ reconciliationDay: later, later: true, chips: [{ kind: 'unreconciledDay', tone: 'flag' }] });
  });

  it('shows a single ✓ naming the later day when the day shown is not flagged', () => {
    expect(run({ day: later })).toEqual({ reconciliationDay: later, later: true, chips: [{ kind: 'notFlagged', tone: 'ok' }] });
  });

  it('ignores the later day\'s own failures: they are not about the day shown', () => {
    expect(kinds({ day: later, bridge: 'mismatch', supply: 'mismatch', supplyDiff: '9' })).toEqual(['notFlagged']);
    expect(kinds({ day: later, bridge: 'mismatch' }, [later])).toEqual(['notFlagged']);
  });
});

describe('checkChips, no chips', () => {
  it('without a reconciliation', () => {
    expect(run(null)).toBeNull();
  });

  it('when the figures of the day are unknown', () => {
    expect(run({}, [], false)).toBeNull();
    expect(run({ day: '2026-10-10' }, [D], false)).toBeNull();
  });

  it('for a reconciliation of an earlier day', () => {
    expect(run({ day: '2026-10-08' })).toBeNull();
  });
});

describe('affectedTerms', () => {
  it('bridge mismatch puts bridge in and bridge out in question', () => {
    expect(affectedTerms(run({ bridge: 'mismatch' }))).toEqual(['bridge_in', 'bridge_out']);
  });

  it('supply mismatch puts net in question', () => {
    expect(affectedTerms(run({ supply: 'mismatch', supplyDiff: '1' }))).toEqual(['net']);
  });

  it('continuity mismatch changes no chip', () => {
    expect(affectedTerms(run({ continuity: 'mismatch' }))).toEqual([]);
  });

  it('collects the terms of several failures', () => {
    expect(affectedTerms(run({ supply: 'mismatch', supplyDiff: '1', bridge: 'mismatch' }))).toEqual(['bridge_in', 'bridge_out', 'net']);
  });

  it('nothing when everything passed, for a later day or without checks', () => {
    expect(affectedTerms(run({}))).toEqual([]);
    expect(affectedTerms(run({ day: '2026-10-10', bridge: 'mismatch' }, [D]))).toEqual([]);
    expect(affectedTerms(null)).toEqual([]);
  });
});
