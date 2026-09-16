import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { FileSignature } from 'lucide-react-native';
import { FITOUT_PAID_BY_LABELS_KA } from '@lokacia/contracts';
import { AuthGate } from '../../components/auth-gate';
import { Screen } from '../../components/screen';
import { Button, Chip, EmptyState, Field, Loading, Section, ToggleRow, Txt } from '../../components/ui';
import { endpoints } from '../../lib/api';
import { errorMessage } from '../../lib/api-client';
import { t } from '../../lib/i18n';
import { gelToMinor, priceLabel } from '../../lib/listing-format';
import { numberOrUndefined } from '../../lib/search-filters';
import { useAsync } from '../../lib/use-async';
import { space } from '../../theme/tokens';

const FITOUT = ['tenant', 'owner', 'shared'] as const;

function OfferForm({ listingId }: { listingId: string }) {
  const listing = useAsync(() => endpoints.listing(listingId), [listingId]);
  const [price, setPrice] = useState('');
  const [term, setTerm] = useState('12');
  const [free, setFree] = useState('0');
  const [indexation, setIndexation] = useState('0');
  const [fitout, setFitout] = useState<(typeof FITOUT)[number]>('tenant');
  const [equipment, setEquipment] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (listing.loading) return <Loading />;

  const submit = async () => {
    const priceMinor = gelToMinor(price || String((listing.data?.priceMinor ?? 0) / 100));
    const termMonths = numberOrUndefined(term);
    if (!priceMinor || !termMonths) return setError(t('common.error'));
    setBusy(true);
    setError(null);
    try {
      await endpoints.sendOffer({
        listingId,
        priceMinor,
        termMonths: Math.round(termMonths),
        freeMonths: Math.round(numberOrUndefined(free) ?? 0),
        indexationPct: Math.round(numberOrUndefined(indexation) ?? 0),
        fitoutPaidBy: fitout,
        equipmentIncluded: equipment,
        message: message.trim() || null,
      });
      setSent(true);
    } catch (e) {
      setError(errorMessage(e, t('common.networkError')));
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={FileSignature} title={t('offers.sent')} action={<Button title={t('offers.title')} onPress={() => router.replace('/offers')} />} />
      </Screen>
    );

  return (
    <Screen scroll edges={['bottom']}>
      {listing.data ? (
        <View style={{ gap: 2 }}>
          <Txt weight="semibold">{listing.data.title}</Txt>
          <Txt color="textMuted" tabular>
            {priceLabel(listing.data)}
          </Txt>
        </View>
      ) : null}
      <Field label={t('offers.price')} keyboardType="decimal-pad" placeholder={listing.data ? String(listing.data.priceMinor / 100) : ''} value={price} onChangeText={setPrice} />
      <View style={{ flexDirection: 'row', gap: space(1) }}>
        <Field style={{ flex: 1 }} label={t('offers.term')} keyboardType="number-pad" value={term} onChangeText={setTerm} />
        <Field style={{ flex: 1 }} label={t('offers.freeMonths')} keyboardType="number-pad" value={free} onChangeText={setFree} />
      </View>
      <Field label={t('offers.indexation')} keyboardType="number-pad" value={indexation} onChangeText={setIndexation} />
      <Section title={t('offers.fitout')}>
        <View style={{ flexDirection: 'row', gap: space(1), flexWrap: 'wrap' }}>
          {FITOUT.map((f) => (
            <Chip key={f} label={FITOUT_PAID_BY_LABELS_KA[f]} selected={fitout === f} onPress={() => setFitout(f)} />
          ))}
        </View>
      </Section>
      <ToggleRow label={t('offers.equipment')} value={equipment} onValueChange={setEquipment} />
      <Field label={t('offers.message')} value={message} onChangeText={setMessage} multiline maxLength={2000} />
      {error ? <Txt color="danger">{error}</Txt> : null}
      <Button title={t('offers.send')} loading={busy} onPress={() => void submit()} />
    </Screen>
  );
}

export default function OfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <AuthGate>
      <OfferForm listingId={id} />
    </AuthGate>
  );
}
