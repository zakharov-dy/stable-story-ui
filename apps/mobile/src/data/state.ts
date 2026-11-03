import type { Overview } from '@app/contracts';

export type ScreenState = 'loading' | 'unavailable' | 'empty' | 'data';

// All ApiError kinds map to unavailable, including a failed refresh with cached data.
export function screenState(error: unknown, data: Overview | undefined): ScreenState {
  if (error !== null && error !== undefined) return 'unavailable';
  if (data === undefined) return 'loading';
  return data.asOf === null ? 'empty' : 'data';
}
