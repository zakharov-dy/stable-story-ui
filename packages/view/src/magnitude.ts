// The order-of-magnitude marker of a feed amount (design: six steps, 10³ … 10⁸ and above). The step
// counts the digits of the integer part of the decimal string, so amounts beyond 2^53 stay exact and
// no `Number` is involved.
import { parseDecimal } from './format.ts';

export const MAGNITUDE_STEPS = 6;

/** 1 for amounts below 10⁴ (including those below 1), 2 for 10⁴ … , 6 for 10⁸ and above. */
export function magnitudeStep(amount: string): number {
  const digits = parseDecimal(amount).int.length;
  return Math.min(MAGNITUDE_STEPS, Math.max(1, digits - 3));
}
