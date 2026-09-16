import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarCheck } from 'lucide-react-native';
import { WEEKDAYS_KA, formatDateKa, formatDateTimeKa } from '@lokacia/contracts';
import { AuthGate } from '../../components/auth-gate';
import { Screen } from '../../components/screen';
import { Button, Chip, EmptyState, Field, Loading, Section, Txt } from '../../components/ui';
import { endpoints } from '../../lib/api';
import { errorMessage } from '../../lib/api-client';
import { t } from '../../lib/i18n';
import { useAsync } from '../../lib/use-async';
import { CANDIDATE_HOURS, atHour, candidateDays, hhmm } from '../../lib/viewing-slots';
import { space } from '../../theme/tokens';

function BookViewing({ listingId }: { listingId: string }) {
  const slots = useAsync(async () => (await endpoints.slots(listingId)).filter((s) => s.kind === 'viewing' && !s.booked && new Date(s.startsAt).getTime() > Date.now()), [listingId]);
  const days = useMemo(() => candidateDays(new Date()), []);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [day, setDay] = useState<Date>(days[0]!);
  const [hour, setHour] = useState<number | null>(null);
  const [mode, setMode] = useState<'onsite' | 'video'>('onsite');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const hasSlots = (slots.data?.length ?? 0) > 0;
  const canSubmit = hasSlots ? !!slotId : hour !== null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const v = await endpoints.bookViewing({ listingId, mode, note: note.trim() || null, ...(hasSlots ? { slotId: slotId! } : { startsAt: atHour(day, hour!).toISOString() }) });
      setDone(formatDateTimeKa(v.startsAt));
    } catch (e) {
      setError(errorMessage(e, t('common.networkError')));
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={CalendarCheck} title={done} hint={t('viewings.booked')} action={<Button title={t('viewings.title')} onPress={() => router.replace('/viewings')} />} />
      </Screen>
    );

  return (
    <Screen scroll edges={['bottom']}>
      {slots.loading ? (
        <Loading />
      ) : hasSlots ? (
        <Section title={t('viewings.slots')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1) }}>
            {slots.data!.map((s) => (
              <Chip key={s.id} label={formatDateTimeKa(s.startsAt)} selected={slotId === s.id} onPress={() => setSlotId(s.id)} />
            ))}
          </View>
        </Section>
      ) : (
        <>
          <Txt color="textMuted">{t('viewings.noSlots')}</Txt>
          <Section title={t('viewings.day')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(1) }}>
              {days.map((d) => (
                <Chip key={d.toISOString()} label={`${WEEKDAYS_KA[d.getDay()]}, ${formatDateKa(d).replace(/, \d{4}$/, '')}`} selected={d.getTime() === day.getTime()} onPress={() => setDay(d)} />
              ))}
            </ScrollView>
          </Section>
          <Section title={t('viewings.time')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1) }}>
              {CANDIDATE_HOURS.map((h) => (
                <Chip key={h} label={hhmm(atHour(day, h))} selected={hour === h} onPress={() => setHour(h)} />
              ))}
            </View>
          </Section>
        </>
      )}
      <Section title={t('viewings.mode')}>
        <View style={{ flexDirection: 'row', gap: space(1) }}>
          <Chip label={t('viewings.onsite')} selected={mode === 'onsite'} onPress={() => setMode('onsite')} />
          <Chip label={t('viewings.video')} selected={mode === 'video'} onPress={() => setMode('video')} />
        </View>
      </Section>
      <Field label={t('viewings.note')} value={note} onChangeText={setNote} multiline maxLength={1000} />
      {error ? (
        <Txt color="danger" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}
      <Button title={t('viewings.submit')} disabled={!canSubmit} loading={busy} onPress={() => void submit()} />
    </Screen>
  );
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <AuthGate>
      <BookViewing listingId={id} />
    </AuthGate>
  );
}
