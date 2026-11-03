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
  ios: { bundleIdentifier: 'stablestory.mobile' },
  android: { package: 'stablestory.mobile' },
  // Public build configuration: never put credentials here.
  extra: { API_MODE: apiMode ?? 'live', API_URL: apiUrl },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-font',
    ['expo-splash-screen', { backgroundColor: tokens['color-bg'] }],
  ],
};

export default config;
