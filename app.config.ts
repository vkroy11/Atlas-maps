import type { ExpoConfig } from 'expo/config';

/**
 * Expo CLI auto-loads `.env` for SDK 49+, so `process.env.MAPTILER_KEY` is
 * available here without `dotenv`. The key is exposed at runtime via
 * `Constants.expoConfig.extra.maptilerKey`.
 */
const config: ExpoConfig = {
  name: 'Atlas Offline',
  slug: 'atlas-offline',
  scheme: 'atlas-offline',
  owner: 'vkroy218',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0f0d',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.atlasoffline.app',
  },
  android: {
    package: 'com.atlasoffline.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a0f0d',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: ['expo-router', 'expo-sqlite', '@maplibre/maplibre-react-native'],
  extra: {
    maptilerKey: process.env.MAPTILER_KEY ?? '',
    eas: {
      projectId: '136cb7a1-5e00-4a6c-9932-0e5a7e0e613d',
    },
  },

};

export default config;
