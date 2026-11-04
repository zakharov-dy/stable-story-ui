/// <reference types="jest" />
import { it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Plot } from './Plot.tsx';
import type { PlotContent } from './Plot.tsx';

jest.mock('@shopify/react-native-skia', () => ({}));
jest.mock('react-native-gesture-handler', () => ({
  usePanGesture: jest.fn(),
  useTapGesture: jest.fn(),
  useCompetingGestures: jest.fn(),
}));

it('shows no data when the server supplies no buckets, without building invalid date ticks', async () => {
  const build = jest.fn<() => PlotContent>();
  await render(<Plot series={{ period: 'day', unit: 'tokens', buckets: [], lines: [] }}
    id="test.chart" label="Tracked supply" build={build} />);
  expect(screen.getByText('No data')).toBeOnTheScreen();
  expect(build).not.toHaveBeenCalled();
});
