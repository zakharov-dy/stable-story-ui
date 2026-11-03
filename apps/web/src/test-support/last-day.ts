// Rendering fixture only: rewrite one chain's day row and final 30D driver point.
// Deliberately not a valid API Overview: supply levels, bucket completeness, all-scope sums
// and window volumes are not reconciled with these values. This isolates zero versus missing
// flows and event-count labels; cross-view consistency is validated in contracts.
import type { Overview } from '@app/contracts';

export interface LastDay {
  events: number | null; // the daily event count; null = the day is not closed for the chain
  flows: 'zero' | 'unknown'; // the four flows and net: real zeros, or null
}

export function withLastDay(overview: Overview, chain: string, day: LastDay): Overview {
  const copy = structuredClone(overview);
  const row = copy.day?.rows.find((candidate) => candidate.scope === chain);
  if (row === undefined) throw new Error('no day row for ' + chain);
  for (const term of ['issuer_mint', 'issuer_burn', 'bridge_in', 'bridge_out', 'net'] as const) row.values[term] = day.flows === 'zero' ? '0' : null;
  row.events = day.events;
  const driver = copy.views['30d']?.drivers.find((driver) => driver.scope === chain);
  if (driver) {
    for (const line of driver.series.lines) line.values[line.values.length - 1] = day.flows === 'zero' ? '0' : null;
    driver.events[driver.events.length - 1] = day.events;
  }
  return copy;
}
