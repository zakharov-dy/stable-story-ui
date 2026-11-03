import { describe, expect, it } from 'vitest';
import { MAGNITUDE_STEPS, magnitudeStep } from './magnitude.ts';

describe('magnitudeStep', () => {
  it.each([
    ['0', 1],
    ['0.000001', 1],
    ['0.99', 1],
    ['1', 1],
    ['999', 1],
    ['1000', 1],
    ['9999.99', 1],
    ['10000', 2],
    ['99999.5', 2],
    ['100000', 3],
    ['999999', 3],
    ['1000000', 4],
    ['9999999.99', 4],
    ['10000000', 5],
    ['99999999.99', 5],
    ['100000000', 6],
    ['250000000', 6],
  ])('%s is step %i', (amount, step) => {
    expect(magnitudeStep(amount)).toBe(step);
  });

  it('keeps the top step above 2^53 and counts digits, not value', () => {
    // 2^53 = 9007199254740992 (16 digits); neighbours that Number cannot tell apart land on the same step.
    expect(magnitudeStep('9007199254740992')).toBe(MAGNITUDE_STEPS);
    expect(magnitudeStep('9007199254740993')).toBe(MAGNITUDE_STEPS);
    expect(magnitudeStep(`1${'0'.repeat(77)}`)).toBe(MAGNITUDE_STEPS);
  });

  it('ignores leading zeros of the integer part', () => {
    expect(magnitudeStep('0009999')).toBe(1);
    expect(magnitudeStep('0010000')).toBe(2);
  });

  it('rejects a string that is not a decimal', () => {
    expect(() => magnitudeStep('1e9')).toThrow(TypeError);
  });
});
