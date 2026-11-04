import type { ExpoConfig } from 'expo/config';
import { tokens } from '@app/tokens';

// Working name from apps/web/src/texts.ts; web texts stay inside the web module.
const productName = 'Stable Story';
const apiMode: unknown = process.env.API_MODE;
const apiUrl: unknown = process.env.API_URL;

const config: ExpoConfig = {
  name: productName,
  slug: 'stablestory',
  scheme: 'stablestory',
  version: '0.0.0',
  platforms: ['ios', 'android'],
  orientation: 'portrait',
  icon: './assets/icon.png',
  ios: { bundleIdentifier: 'stablestory.mobile', userInterfaceStyle: 'dark' },
  android: {
    package: 'stablestory.mobile',
    adaptiveIcon: { foregroundImage: './assets/adaptive-foreground.png', backgroundColor: tokens['color-surface'] },
  },
  // Public build configuration: never put credentials here.
  extra: { API_MODE: apiMode ?? 'live', API_URL: apiUrl },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-font',
    ['expo-splash-screen', { image: './assets/splash.png', imageWidth: 96, backgroundColor: tokens['color-bg'] }],
  ],
};

export default config;
