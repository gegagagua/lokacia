import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { LogIn } from 'lucide-react-native';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import { Screen } from './screen';
import { Button, EmptyState, Loading } from './ui';

/** Renders children for signed-in users; otherwise explains why and offers the phone login. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, ready } = useSession();
  if (!ready)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (!user)
    return (
      <Screen>
        <EmptyState icon={LogIn} title={t('common.loginRequired')} hint={t('common.loginRequiredHint')} action={<Button title={t('common.goToLogin')} onPress={() => router.push('/login')} />} />
      </Screen>
    );
  return <>{children}</>;
}
