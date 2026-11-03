/// <reference types="jest" />
import { afterEach, beforeEach, describe, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import type { RefreshControlProps, ScrollViewProps } from 'react-native';
import { createMockClient, Overview } from '@app/contracts';
import type { ApiClient, MockState } from '@app/contracts';
import { DataProvider } from './Provider.tsx';
import { PlaceholderScreen } from './PlaceholderScreen.tsx';

let mockScenario: string | undefined;
jest.mock('expo-router', () => ({ useGlobalSearchParams: () => ({ devScenario: mockScenario }) }));
jest.mock('expo-dev-client', () => ({ registerDevMenuItems: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { name: 'Stable Story', extra: { API_MODE: 'mock' } } } }));

beforeEach(() => {
  mockScenario = undefined;
  jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Network forbidden in native tests'); });
  jest.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  expect(globalThis.fetch).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

const probe = (client?: ApiClient) => <DataProvider client={client}><PlaceholderScreen /></DataProvider>;
const expectState = async (state: string) => {
  await waitFor(() => expect(screen.getByTestId('overview.state')).toHaveTextContent(state));
};

describe('real contract mock states', () => {
  it('loads the contract catalog in the native test runtime', async () => {
    await expect(createMockClient('ok').overview()).resolves.toHaveProperty('asOf', '2026-10-09');
  });
  const cases: [MockState, string, string, number][] = [
    ['ok', '2026-10-09', '2026-08-26', 3],
    ['delayed', '2026-10-08', '2026-08-26', 3],
    ['unreconciled', '2026-10-09', '2026-08-26', 3],
    ['empty-day', '2026-10-09', '2026-08-26', 3],
    ['short-history', '2026-10-09', '2026-10-03', 3],
    ['gap', '2026-10-09', '2026-10-03', 3],
    ['long-history', '2027-03-15', '2026-11-15', 6],
  ];
  it.each(cases)('%s shows the response dates and chain count', async (state, asOf, start, chains) => {
    await render(probe(createMockClient(state)));
    await expectState('data');
    expect(screen.getByTestId('overview.as-of')).toHaveTextContent(`asOf: ${asOf}`);
    expect(screen.getByTestId('overview.history-start')).toHaveTextContent(`historyStart: ${start}`);
    expect(screen.getByTestId('overview.chains')).toHaveTextContent(`chains: ${chains}`);
    expect(screen.queryByTestId('overview.retry')).toBeNull();
  });
  it('empty shows null coverage without replacing it or the chain count with zero', async () => {
    await render(probe(createMockClient('empty')));
    await expectState('empty');
    expect(screen.getByTestId('overview.as-of')).toHaveTextContent('asOf: null');
    expect(screen.getByTestId('overview.history-start')).toHaveTextContent('historyStart: null');
    expect(screen.getByTestId('overview.chains')).toHaveTextContent('chains: 3');
  });
  it('zero chains remains zero, while coverage remains null', async () => {
    const mock = createMockClient('empty');
    const empty = await mock.overview();
    const zero = Overview.parse({ ...empty, chains: [], status: { ...empty.status, chains: [] } });
    await render(probe({ ...mock, overview: () => Promise.resolve(zero) }));
    await expectState('empty');
    expect(screen.getByTestId('overview.chains')).toHaveTextContent('chains: 0');
    expect(screen.getByTestId('overview.as-of')).toHaveTextContent('asOf: null');
  });
  it('unavailable exposes a labelled retry button and recovers on retry', async () => {
    let fail = true;
    const ok = createMockClient('ok');
    const unavailable = createMockClient('unavailable');
    const overview = jest.fn<ApiClient['overview']>((params, options) => (fail ? unavailable : ok).overview(params, options));
    await render(probe({ ...ok, overview }));
    await expectState('unavailable');
    expect(overview).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('overview.as-of')).toBeNull();
    const retry = screen.getByRole('button', { name: 'Retry overview' });
    expect(retry).toBe(screen.getByTestId('overview.retry'));
    fail = false;
    await fireEvent.press(retry);
    await expectState('data');
    expect(overview).toHaveBeenCalledTimes(2);
  });
});

it('shows loading while the overview promise is pending', async () => {
  const mock = createMockClient('ok');
  let release = (): void => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await render(probe({ ...mock, overview: async (params, options) => { await pending; return mock.overview(params, options); } }));
  await expectState('loading');
  expect(screen.queryByTestId('overview.as-of')).toBeNull();
  await act(async () => { release(); await pending; });
  await expectState('data');
});

it('pull-to-refresh exposes failure with cached data and can recover', async () => {
  let fail = false;
  const mock = createMockClient('ok');
  const unavailable = createMockClient('unavailable');
  await render(probe({ ...mock, overview: (params, options) => (fail ? unavailable : mock).overview(params, options) }));
  await expectState('data');
  fail = true;
  // RN's Jest ScrollView does not mount its refreshControl prop as a child.
  const scroll = screen.getByTestId('overview.screen').props as ScrollViewProps;
  const refresh = scroll.refreshControl as ReactElement<RefreshControlProps>;
  expect(refresh.props.testID).toBe('overview.refresh');
  expect(refresh.props.accessibilityLabel).toBe('Refresh overview');
  await act(async () => { await refresh.props.onRefresh?.(); });
  await expectState('unavailable');
  expect(screen.queryByTestId('overview.as-of')).toBeNull();
  fail = false;
  await fireEvent.press(screen.getByTestId('overview.retry'));
  await expectState('data');
});

it('scenario switching clears the previous cache and shows the next mock response', async () => {
  const rendered = await render(probe());
  await expectState('data');
  expect(screen.getByTestId('overview.as-of')).toHaveTextContent('asOf: 2026-10-09');
  mockScenario = 'empty';
  await rendered.rerender(probe());
  await expectState('empty');
  expect(screen.getByTestId('overview.as-of')).toHaveTextContent('asOf: null');
  mockScenario = 'unavailable';
  await rendered.rerender(probe());
  await expectState('unavailable');
  expect(screen.queryByTestId('overview.as-of')).toBeNull();
  mockScenario = 'delayed';
  await rendered.rerender(probe());
  await expectState('data');
  expect(screen.getByTestId('overview.as-of')).toHaveTextContent('asOf: 2026-10-08');
});
