import { Stack } from 'expo-router';
import { theme } from '../../../src/theme/index.ts';

export const unstable_settings = { anchor: 'index' };

export default function TodayLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors['color-bg'] } }} />;
}
