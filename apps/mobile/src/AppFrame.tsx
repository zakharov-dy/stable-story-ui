import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Text as NativeText } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk/400Regular';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { theme } from './theme/index.ts';

void SplashScreen.preventAutoHideAsync();

export function AppFrame({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts({
    [theme.fonts.sans]: SpaceGrotesk_400Regular,
    [theme.fonts.mono]: IBMPlexMono_400Regular,
  });
  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);
  if (!loaded && !error) return null;
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: theme.colors['color-bg'] }}>
    <StatusBar style="light" />
    {error ? <NativeText testID="app.font-error" accessibilityRole="alert" style={{ color: theme.colors['color-text'], fontSize: theme.typeScale.md }}>Fonts could not load. Please restart the app.</NativeText> : children}
  </SafeAreaView></SafeAreaProvider>;
}
