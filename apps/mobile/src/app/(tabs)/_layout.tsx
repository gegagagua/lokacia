import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { Heart, Map as MapIcon, MessageSquare, Search, UserRound, type LucideIcon } from 'lucide-react-native';
import { t } from '../../lib/i18n';
import { useAppTheme } from '../../theme/theme';
import { fonts } from '../../theme/tokens';

const icon =
  (Icon: LucideIcon) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Icon color={color as string} size={size} strokeWidth={1.5} strokeLinecap="square" />;

export default function TabsLayout() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.search'), tabBarIcon: icon(Search) }} />
      <Tabs.Screen name="map" options={{ title: t('tabs.map'), tabBarIcon: icon(MapIcon) }} />
      <Tabs.Screen name="favorites" options={{ title: t('tabs.favorites'), tabBarIcon: icon(Heart) }} />
      <Tabs.Screen name="messages" options={{ title: t('tabs.messages'), tabBarIcon: icon(MessageSquare) }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon(UserRound) }} />
    </Tabs>
  );
}
