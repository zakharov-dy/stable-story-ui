// What the page renders: one overview response classified into the three page states.
import type { ApiErrorKind, MockState, Overview } from '@app/contracts';

export type PageModel =
  | { state: 'data'; overview: Overview } // 200 with common coverage
  | { state: 'empty'; overview: Overview } // 200 with asOf: null
  | { state: 'unavailable'; reason: ApiErrorKind }; // any ApiError

export interface PageProps {
  model: PageModel;
  demoState: MockState | null; // the mock state when API_MODE=mock, labelled as demo data
}
