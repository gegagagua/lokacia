import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { endpoints } from './api';
import { EAS_PROJECT_ID } from './config';
import { t } from './i18n';

export type PushStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

let registeredToken: string | null = null;

export function configureNotificationHandler() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export async function pushStatus(): Promise<PushStatus> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

/**
 * Asks permission (when `prompt`), gets the Expo push token and registers it with POST /v1/users/me/push-token.
 * Requires an EAS project id (HUMAN_TODO: EAS project + APNs key + FCM credentials).
 */
export async function registerForPush(prompt: boolean): Promise<PushStatus> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: t('notifications.channel'), importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#1E4A42' });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && prompt) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return status === 'denied' ? 'denied' : 'undetermined';
  const { data } = await Notifications.getExpoPushTokenAsync(EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined);
  if (data && data !== registeredToken) {
    await endpoints.registerPushToken(data, Platform.OS === 'ios' ? 'ios' : 'android');
    registeredToken = data;
  }
  return 'granted';
}

export async function unregisterPush() {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await endpoints.unregisterPushToken(token);
}
