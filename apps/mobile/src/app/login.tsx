import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { normalizePhone } from '@lokacia/contracts';
import { LogoMark } from '../components/logo';
import { Screen } from '../components/screen';
import { Button, Field, Txt } from '../components/ui';
import { api, endpoints } from '../lib/api';
import { errorMessage } from '../lib/api-client';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import { space } from '../theme/tokens';

export default function LoginScreen() {
  const { signIn } = useSession();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [normalized, setNormalized] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void endpoints
      .providers()
      .then((p) => setDevCode(p.otpDevCode))
      .catch(() => undefined);
  }, []);

  const request = async () => {
    const n = normalizePhone(phone);
    if (!n) return setError(t('auth.invalidPhone'));
    setBusy(true);
    setError(null);
    try {
      const r = await api.requestOtp(n);
      if (r.devCode) setDevCode(r.devCode);
      setNormalized(n);
      setStep('code');
    } catch (e) {
      setError(errorMessage(e, t('common.networkError')));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) return setError(t('auth.invalidCode'));
    setBusy(true);
    setError(null);
    try {
      await signIn(normalized!, code, name.trim() || undefined);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(errorMessage(e, t('common.networkError')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll edges={['bottom']}>
        <View style={{ alignItems: 'center', gap: space(1), paddingVertical: space(2) }}>
          <LogoMark size={56} />
          <Txt variant="h2" weight="semibold" accessibilityRole="header" style={{ textAlign: 'center' }}>
            {t('auth.title')}
          </Txt>
          <Txt color="textMuted" style={{ textAlign: 'center' }}>
            {t('auth.subtitle')}
          </Txt>
        </View>
        {step === 'phone' ? (
          <>
            <Field label={t('auth.phone')} placeholder={t('auth.phonePlaceholder')} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" value={phone} onChangeText={setPhone} onSubmitEditing={() => void request()} error={error} />
            <Button title={t('auth.sendCode')} loading={busy} onPress={() => void request()} />
          </>
        ) : (
          <>
            <Txt color="textMuted">{t('auth.codeHint', { phone: normalized ?? '' })}</Txt>
            {devCode ? (
              <Txt variant="small" color="link">
                {t('auth.devCode', { code: devCode })}
              </Txt>
            ) : null}
            <Field label={t('auth.code')} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6} value={code} onChangeText={setCode} onSubmitEditing={() => void verify()} error={error} />
            <Field label={t('auth.name')} value={name} onChangeText={setName} autoComplete="name" />
            <Button title={t('auth.verify')} loading={busy} onPress={() => void verify()} />
            <Button kind="ghost" title={t('auth.changePhone')} onPress={() => setStep('phone')} />
          </>
        )}
        <Txt variant="small" color="textMuted" style={{ textAlign: 'center' }}>
          {t('auth.consent')}
        </Txt>
      </Screen>
    </KeyboardAvoidingView>
  );
}
