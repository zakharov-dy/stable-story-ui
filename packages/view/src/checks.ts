// The reconciliation chips of a chain's day-equation card (docs/design.md, rule of D2-B1). The
// figures are those of `asOf` (D); the chain's reconciliation R describes its own last closed day,
// which is D or a later one when the chain is ahead of the others. The result is data only: the
// component maps it to texts.
import type { ChainStatus } from '@app/contracts';

export type CheckKind =
  | 'passed' // every check that applies passed
  | 'supply' // Δ totalSupply ≠ Σ events
  | 'bridge' // bridge flows ≠ CCTP operations
  | 'continuity' // the day does not join the previous one
  | 'continuityFirst' // no previous day to join: not a failure
  | 'unreconciledDay' // D is in unreconciledDays, the checks shown are for a later day
  | 'notFlagged'; // D is not flagged, the checks shown are for a later day

export type CheckTone = 'ok' | 'bad' | 'muted' | 'flag';

export interface CheckChip {
  kind: CheckKind;
  tone: CheckTone;
  supplyDiff?: string; // kind 'supply': the exact difference from the API
}

export interface ChainChecks {
  reconciliationDay: string; // R.day: the day the checks are for
  later: boolean; // R.day is after D
  chips: CheckChip[];
}

export interface ChecksInput {
  asOf: string; // D
  reconciliation: ChainStatus['reconciliation']; // R
  unreconciledDays: readonly string[]; // status.chains[chain].unreconciledDays
  figuresKnown: boolean; // the day's values of the chain are all known (none is null)
}

/**
 * R.day = D: one chip per failed check, and "checks passed" when nothing failed; a first day
 * without continuity adds a muted chip (it is not a failure). R.day > D: "unreconciled day" when D is
 * flagged, else a single ✓. No reconciliation, a reconciliation of an earlier day or unknown
 * figures: no chips (null).
 */
export function checkChips({ asOf, reconciliation, unreconciledDays, figuresKnown }: ChecksInput): ChainChecks | null {
  if (reconciliation === null || !figuresKnown || reconciliation.day < asOf) return null;
  const reconciliationDay = reconciliation.day;
  if (reconciliationDay > asOf) {
    const flagged = unreconciledDays.includes(asOf);
    return {
      reconciliationDay,
      later: true,
      chips: [flagged ? { kind: 'unreconciledDay', tone: 'flag' } : { kind: 'notFlagged', tone: 'ok' }],
    };
  }
  const chips: CheckChip[] = [];
  if (reconciliation.supply === 'mismatch') chips.push({ kind: 'supply', tone: 'bad', supplyDiff: reconciliation.supplyDiff });
  if (reconciliation.bridge === 'mismatch') chips.push({ kind: 'bridge', tone: 'bad' });
  if (reconciliation.continuity === 'mismatch') chips.push({ kind: 'continuity', tone: 'bad' });
  if (chips.length === 0) chips.push({ kind: 'passed', tone: 'ok' });
  if (reconciliation.continuity === 'none') chips.push({ kind: 'continuityFirst', tone: 'muted' });
  return { reconciliationDay, later: false, chips };
}

export type Term = 'issuer_mint' | 'issuer_burn' | 'bridge_in' | 'bridge_out' | 'net';

/**
 * The terms of the equation a failed check puts in question (dashed chips). Only for the checks of
 * the day shown: bridge → bridge in and out, supply → net, continuity → none.
 */
export function affectedTerms(checks: ChainChecks | null): Term[] {
  if (checks === null || checks.later) return [];
  const kinds = new Set(checks.chips.map((chip) => chip.kind));
  return [...(kinds.has('bridge') ? (['bridge_in', 'bridge_out'] as const) : []), ...(kinds.has('supply') ? (['net'] as const) : [])];
}
