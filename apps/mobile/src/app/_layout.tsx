import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, ThemeProvider, DarkTheme, DefaultTheme, router, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotoSansGeorgian_300Light } from '@expo-google-fonts/noto-sans-georgian/300Light';
import { NotoSansGeorgian_400Regular } from '@expo-google-fonts/noto-sans-georgian/400Regular';
import { NotoSansGeorgian_500Medium } from '@expo-google-fonts/noto-sans-georgian/500Medium';
import { NotoSansGeorgian_600SemiBold } from '@expo-google-fonts/noto-sans-georgian/600SemiBold';
import { NotoSansGeorgian_700Bold } from '@expo-google-fonts/noto-sans-georgian/700Bold';
import { t } from '../lib/i18n';
import { configureNotificationHandler, registerForPush } from '../lib/push';
import { SessionProvider, useSession } from '../lib/session';
import { linkToRoute } from '../lib/urls';
import { AppThemeProvider, useAppTheme } from '../theme/theme';
import { fonts } from '../theme/tokens';

void SplashScreen.preventAutoHideAsync();
configureNotificationHandler();

function PushBridge() {
  const { user } = useSession();
  useEffect(() => {
    if (!user || Platform.OS === 'web') return;
    // registers silently when permission was already granted (prompt happens from Profile)
    void registerForPush(false).catch(() => undefined);
    const open = (data: unknown) => {
      const route = linkToRoute((data as { link?: string } | undefined)?.link);
      if (route) router.push(route as never);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification.request.content.data);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    return () => sub.remove();
  }, [user]);
  return null;
}

function Navigation() {
  const { dark, colors } = useAppTheme();
  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: colors.primary, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border, notification: colors.accent },
  };
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <PushBridge />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.semibold },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t('common.appName') }} />
        <Stack.Screen name="listing/[id]" options={{ title: '' }} />
        <Stack.Screen name="chat/[id]" options={{ title: t('messages.title') }} />
        <Stack.Screen name="book/[id]" options={{ title: t('viewings.book'), presentation: 'modal' }} />
        <Stack.Screen name="offer/[id]" options={{ title: t('offers.send'), presentation: 'modal' }} />
        <Stack.Screen name="filters" options={{ title: t('filters.title'), presentation: 'modal' }} />
        <Stack.Screen name="login" options={{ title: t('auth.title'), presentation: 'modal' }} />
        <Stack.Screen name="viewings" options={{ title: t('viewings.title') }} />
        <Stack.Screen name="offers" options={{ title: t('offers.title') }} />
        <Stack.Screen name="broker/new" options={{ title: t('broker.title') }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ NotoSansGeorgian_300Light, NotoSansGeorgian_400Regular, NotoSansGeorgian_500Medium, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_700Bold });
  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <SessionProvider>
          <Navigation />
        </SessionProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
