// Rendering fixture only: move dates across New Year without rebuilding public calendar intervals.
// Deliberately not a valid API Overview: shifted weeks/months are not canonical intervals.
// This isolates date formatting; canonical interval validation is owned by contracts.
import type { Overview } from '@app/contracts';
import { addDays } from '../view.ts';

const DATE = /\d{4}-\d{2}-\d{2}/g;

export function shiftOverview(overview: Overview, days: number): Overview {
  const moved = JSON.stringify(overview).replace(DATE, (date) => addDays(date, days));
  return JSON.parse(moved) as Overview; // A formatting fixture; shifted months are not an API selection.
}
