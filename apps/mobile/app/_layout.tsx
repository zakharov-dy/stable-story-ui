import { Stack } from 'expo-router';
import { AppFrame } from '../src/AppFrame.tsx';
import { DataProvider } from '../src/data/Provider.tsx';
import { theme } from '../src/theme/index.ts';

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  return <AppFrame><DataProvider>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors['color-bg'] } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="data" options={{
        presentation: 'formSheet',
        sheetAllowedDetents: [0.7, 1],
        sheetGrabberVisible: true,
        sheetCornerRadius: theme.dimensions['radius-sheet'],
        contentStyle: { backgroundColor: theme.colors['color-surface'] },
      }} />
    </Stack>
  </DataProvider></AppFrame>;
}
