import Constants from 'expo-constants';

/**
 * API base URL: `EXPO_PUBLIC_API_URL` (inlined by Metro at build time) → app.config `extra.apiUrl` → localhost.
 * Android emulator reaches the host machine at http://10.0.2.2:4000; a physical device needs the LAN IP.
 */
export const API_URL: string = (process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra?.apiUrl as string | undefined) || 'http://localhost:4000').replace(/\/+$/, '');

export const APP_VERSION: string = Constants.expoConfig?.version ?? '1.0.0';
export const EAS_PROJECT_ID: string | undefined = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ?? Constants.easConfig?.projectId;
