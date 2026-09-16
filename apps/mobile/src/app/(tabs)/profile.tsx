import { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, Building2, CalendarClock, ChevronRight, FileSignature, LogIn, LogOut, type LucideIcon } from 'lucide-react-native';
import { LogoMark } from '../../components/logo';
import { Screen } from '../../components/screen';
import { Button, Card, Divider, Txt } from '../../components/ui';
import { API_URL, APP_VERSION } from '../../lib/config';
import { t } from '../../lib/i18n';
import { pushStatus, registerForPush, type PushStatus } from '../../lib/push';
import { useSession } from '../../lib/session';
import { useAppTheme } from '../../theme/theme';
import { space } from '../../theme/tokens';

function Row({ icon: Icon, title, hint, onPress }: { icon: LucideIcon; title: string; hint?: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space(1.5), minHeight: 56, opacity: pressed ? 0.7 : 1 })}>
      <Icon size={22} color={colors.primary} strokeWidth={1.5} strokeLinecap="square" />
      <View style={{ flex: 1 }}>
        <Txt weight="medium">{title}</Txt>
        {hint ? (
          <Txt variant="small" color="textMuted">
            {hint}
          </Txt>
        ) : null}
      </View>
      <ChevronRight size={20} color={colors.textMuted} strokeWidth={1.5} />
    </Pressable>
  );
}

export default function ProfileTab() {
  const { user, agencyOrgs, signOut } = useSession();
  const [push, setPush] = useState<PushStatus>('unsupported');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) void pushStatus().then(setPush);
  }, [user]);

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
        <LogoMark size={40} />
        <View style={{ flex: 1 }}>
          <Txt variant="h2" weight="semibold" accessibilityRole="header">
            {user?.name ?? t('profile.title')}
          </Txt>
          <Txt color="textMuted" tabular>
            {user?.phone ?? t('profile.guest')}
          </Txt>
        </View>
      </View>
      {!user ? (
        <Button icon={LogIn} title={t('common.goToLogin')} onPress={() => router.push('/login')} />
      ) : (
        <>
          <Card style={{ paddingVertical: space(0.5) }}>
            <Row icon={CalendarClock} title={t('profile.viewings')} onPress={() => router.push('/viewings')} />
            <Divider />
            <Row icon={FileSignature} title={t('profile.offers')} onPress={() => router.push('/offers')} />
            {agencyOrgs.length ? (
              <>
                <Divider />
                <Row icon={Building2} title={t('profile.broker')} hint={t('profile.brokerHint')} onPress={() => router.push('/broker/new')} />
              </>
            ) : null}
          </Card>
          <Card style={{ gap: space(1) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
              <Bell size={22} color="#D8A31A" strokeWidth={1.5} />
              <Txt weight="medium" style={{ flex: 1 }}>
                {t('profile.push')}
              </Txt>
              <Txt variant="small" color="textMuted">
                {push === 'granted' ? t('profile.pushOn') : t('profile.pushOff')}
              </Txt>
            </View>
            {push === 'unsupported' ? (
              <Txt variant="small" color="textMuted">
                {t('profile.pushUnsupported')}
              </Txt>
            ) : push === 'denied' ? (
              <>
                <Txt variant="small" color="textMuted">
                  {t('profile.pushDenied')}
                </Txt>
                <Button kind="secondary" compact title={t('profile.pushEnable')} onPress={() => void Linking.openSettings()} />
              </>
            ) : push !== 'granted' ? (
              <Button
                kind="secondary"
                compact
                loading={busy}
                title={t('profile.pushEnable')}
                onPress={async () => {
                  setBusy(true);
                  setPush(await registerForPush(true).catch(() => 'undetermined' as const));
                  setBusy(false);
                }}
              />
            ) : null}
          </Card>
          <Button kind="secondary" icon={LogOut} title={t('profile.logout')} onPress={() => void signOut()} />
        </>
      )}
      <View style={{ gap: 2 }}>
        <Txt variant="small" color="textMuted">
          {t('profile.version', { v: APP_VERSION })}
        </Txt>
        <Txt variant="small" color="textMuted">
          {t('profile.api', { url: API_URL })}
        </Txt>
      </View>
    </Screen>
  );
}
