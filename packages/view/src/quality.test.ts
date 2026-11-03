import { describe, expect, it } from 'vitest';
import { merge, splitHeaderNotes, type QualityFlag, type QualitySummary } from './quality.ts';

const summary = (...flags: QualityFlag[]): QualitySummary => ({ flags, unreconciledDays: ['2026-10-09'], unpairedEvents: 1 });

describe('splitHeaderNotes', () => {
  it('puts missing data and the operation counts that go with it above, the rest below', () => {
    const { above, below } = splitHeaderNotes(summary('incomplete', 'unreconciled', 'operations-incomplete', 'unpaired'));
    expect(above.flags).toEqual(['incomplete', 'operations-incomplete']);
    expect(below.flags).toEqual(['unreconciled', 'unpaired']);
  });

  it('keeps operation counts below when no data is missing', () => {
    const { above, below } = splitHeaderNotes(summary('unreconciled', 'operations-incomplete', 'unpaired'));
    expect(above.flags).toEqual([]);
    expect(below.flags).toEqual(['unreconciled', 'operations-incomplete', 'unpaired']);
  });

  it('keeps the days and the count for the notes that use them', () => {
    const { below } = splitHeaderNotes(summary('unreconciled'));
    expect(below.unreconciledDays).toEqual(['2026-10-09']);
    expect(below.unpairedEvents).toBe(1);
  });

  it('works on a merged summary', () => {
    const merged = merge([summary('unreconciled'), summary('incomplete')]);
    expect(splitHeaderNotes(merged).above.flags).toEqual(['incomplete']);
  });
});
