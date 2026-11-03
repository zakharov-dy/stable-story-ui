/// <reference types="jest" />
import { it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AppFrame } from './AppFrame.tsx';

jest.mock('expo-font', () => ({ useFonts: () => [false, new Error('Font failed')] }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined), hideAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) }));
jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default);

it('font failure hides splash and renders an accessible fallback instead of children', async () => {
  await render(<AppFrame><Text>Child content</Text></AppFrame>);
  expect(screen.getByRole('alert')).toBe(screen.getByTestId('app.font-error'));
  expect(screen.getByRole('alert')).toHaveTextContent('Fonts could not load. Please restart the app.');
  expect(screen.queryByText('Child content')).toBeNull();
  expect(SplashScreen.hideAsync).toHaveBeenCalled();
});
