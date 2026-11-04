/// <reference types="jest" />
import { afterEach, beforeEach, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { createMockClient } from '@app/contracts';
import { useRouter } from 'expo-router';
import { DataProvider } from '../../data/Provider.tsx';
import TodayScreen from './index.tsx';
import { Waterfall } from './Waterfall.tsx';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('expo-dev-client', () => ({ registerDevMenuItems: jest.fn() }));
jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default);

beforeEach(() => {
  jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Unexpected network request'); });
});
afterEach(() => {
  expect(globalThis.fetch).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

it('renders the published figure, signed delta, flow terms and chain drilldown', async () => {
  const push = jest.fn();
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  await render(<DataProvider client={createMockClient('ok')}><TodayScreen /></DataProvider>);
  expect(await screen.findByTestId('today.supply')).toHaveTextContent('12.05K');
  expect(screen.getByTestId('today.delta-day')).toHaveTextContent('+201 today');
  expect(screen.getByTestId('today.delta-week')).toHaveTextContent('+1K 7d');
  expect(screen.getByTestId('waterfall.issuer_mint')).toHaveTextContent('+67M');
  expect(screen.getByTestId('waterfall.issuer_burn')).toHaveTextContent('−67M');
  expect(screen.getByTestId('waterfall.bridge_in')).toHaveTextContent('+300');
  expect(screen.getByTestId('waterfall.bridge_out')).toHaveTextContent('−120');
  expect(screen.getByTestId('waterfall.net')).toHaveTextContent('+201');
  expect(screen.getByTestId('today.net.ethereum')).toHaveTextContent('+67');
  await fireEvent.press(screen.getByTestId('today.chain.ethereum'));
  expect(push).toHaveBeenCalledWith({ pathname: '/chain/[slug]', params: { slug: 'ethereum' } });
  await fireEvent.press(screen.getByTestId('today.data'));
  expect(push).toHaveBeenCalledWith('/data');
});

it('retains distinct unknown and zero terms and the reconciliation flag', async () => {
  await render(<Waterfall day={{ date: '2026-10-09', rows: [{
    scope: 'all', events: null, unreconciled: true,
    values: { issuer_mint: null, issuer_burn: '0', bridge_in: null, bridge_out: '0', net: null },
  }] }} />);
  expect(screen.getByTestId('waterfall.issuer_mint')).toHaveTextContent('No data');
  expect(screen.getByTestId('waterfall.issuer_burn')).toHaveTextContent(/^0$/);
  expect(screen.getByTestId('waterfall.net')).toHaveTextContent('No data');
  expect(screen.getByText(/Unreconciled day/)).toBeOnTheScreen();
});

it('identifies the delayed chain from its own status', async () => {
  await render(<DataProvider client={createMockClient('delayed')}><TodayScreen /></DataProvider>);
  expect(await screen.findByText('30 h')).toBeOnTheScreen();
});
