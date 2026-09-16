import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * lokacia.ge mobile (V7). Variants: development / preview / production (eas.json `APP_VARIANT`).
 * API base URL comes from `EXPO_PUBLIC_API_URL` (inlined at build time; default http://localhost:4000,
 * Android emulator: http://10.0.2.2:4000).
 */
const VARIANT = (process.env.APP_VARIANT ?? 'development') as 'development' | 'preview' | 'production';
const SUFFIX = VARIANT === 'production' ? '' : `.${VARIANT === 'preview' ? 'preview' : 'dev'}`;
const NAME = VARIANT === 'production' ? 'lokacia.ge' : `lokacia.ge (${VARIANT === 'preview' ? 'preview' : 'dev'})`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: NAME,
  slug: 'lokacia',
  scheme: 'lokacia',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#EDF0EB',
  primaryColor: '#1E4A42',
  description: 'კომერციული ფართების ძებნა და ბროკერის რეჟიმი — lokacia.ge',
  ios: {
    bundleIdentifier: `ge.lokacia.app${SUFFIX}`,
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSCameraUsageDescription: 'კამერა საჭიროა ფართის ფოტოების გადასაღებად.',
      NSPhotoLibraryUsageDescription: 'ფოტოები საჭიროა განცხადებაზე დასამატებლად.',
      NSLocationWhenInUseUsageDescription: 'მდებარეობა საჭიროა ფართის კოორდინატების შესაზღვრად და რუკაზე ახლოს მყოფი ფართების საჩვენებლად.',
      NSMicrophoneUsageDescription: 'მიკროფონი საჭიროა ხმოვანი ჩანაწერისთვის.',
    },
  },
  android: {
    package: `ge.lokacia.app${SUFFIX}`,
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#EDF0EB', monochromeImage: './assets/adaptive-icon-mono.png' },
    permissions: ['CAMERA', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'RECORD_AUDIO', 'POST_NOTIFICATIONS'],
  },
  web: { output: 'single', favicon: './assets/favicon.png', bundler: 'metro' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-font', {}],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#EDF0EB',
        dark: { image: './assets/splash-icon-dark.png', backgroundColor: '#17201D' },
      },
    ],
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#1E4A42' }],
    ['expo-image-picker', { cameraPermission: 'კამერა საჭიროა ფართის ფოტოების გადასაღებად.', photosPermission: 'ფოტოები საჭიროა განცხადებაზე დასამატებლად.' }],
    ['expo-location', { locationWhenInUsePermission: 'მდებარეობა საჭიროა ფართის კოორდინატების შესაზღვრად.' }],
    ['expo-audio', { microphonePermission: 'მიკროფონი საჭიროა ხმოვანი ჩანაწერისთვის.' }],
    '@maplibre/maplibre-react-native',
  ],
  experiments: { typedRoutes: false },
  extra: {
    variant: VARIANT,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
  updates: process.env.EAS_PROJECT_ID ? { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` } : undefined,
  runtimeVersion: { policy: 'appVersion' },
});
