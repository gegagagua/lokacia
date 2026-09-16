import { FlatList, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { FileSignature } from 'lucide-react-native';
import { OFFER_STATUS_LABELS_KA, formatDateKa, formatMoney } from '@lokacia/contracts';
import { AuthGate } from '../components/auth-gate';
import { Screen } from '../components/screen';
import { Badge, Button, Card, EmptyState, ErrorBox, Loading, Txt } from '../components/ui';
import { endpoints } from '../lib/api';
import { errorMessage } from '../lib/api-client';
import { t } from '../lib/i18n';
import { useAsync } from '../lib/use-async';
import { useSession } from '../lib/session';
import { useAppTheme } from '../theme/theme';
import { space } from '../theme/tokens';

function Offers() {
  const { colors } = useAppTheme();
  const { user } = useSession();
  const q = useAsync(() => endpoints.offers(), []);
  const act = async (id: string, action: 'accept' | 'reject' | 'withdraw') => {
    try {
      await endpoints.offerAction(id, action);
    } finally {
      await q.reload({ silent: true });
    }
  };
  return (
    <Screen edges={['bottom']}>
      {q.error ? <ErrorBox message={errorMessage(q.error, t('common.networkError'))} onRetry={() => void q.reload()} /> : null}
      <FlatList
        data={q.data ?? []}
        keyExtractor={(o) => o.rootId}
        contentContainerStyle={{ padding: space(2), gap: space(1.5), paddingBottom: space(6) }}
        renderItem={({ item }) => {
          const o = item.latest;
          const open = o.status === 'pending' || o.status === 'countered';
          const incoming = o.toUserId === user?.id;
          return (
            <Card style={{ gap: space(1) }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(1) }}>
                <Badge label={item.direction === 'received' ? t('offers.received') : t('offers.outgoing')} />
                <Badge label={OFFER_STATUS_LABELS_KA[o.status]} tone={o.status === 'accepted' ? 'success' : o.status === 'rejected' || o.status === 'withdrawn' ? 'danger' : 'neutral'} />
              </View>
              <Txt numberOfLines={2} weight="medium" onPress={() => router.push(`/listing/${item.listing.id}`)} accessibilityRole="link">
                {item.listing.title}
              </Txt>
              <Txt tabular>{t('offers.summary', { price: formatMoney(o.priceMinor), term: o.termMonths })}</Txt>
              <Txt variant="small" color="textMuted">
                {[item.counterpart.name, formatDateKa(o.createdAt), item.count > 1 ? t('offers.round', { n: item.count }) : null].filter(Boolean).join(' · ')}
              </Txt>
              {o.message ? <Txt variant="small">{o.message}</Txt> : null}
              {item.actionRequired && open ? (
                <Txt variant="small" color="link">
                  {t('offers.actionRequired')}
                </Txt>
              ) : null}
              {open ? (
                <View style={{ flexDirection: 'row', gap: space(1), flexWrap: 'wrap' }}>
                  {incoming ? (
                    <>
                      <Button compact title={t('offers.accept')} onPress={() => void act(o.id, 'accept')} />
                      <Button compact kind="secondary" title={t('offers.reject')} onPress={() => void act(o.id, 'reject')} />
                    </>
                  ) : (
                    <Button compact kind="secondary" title={t('offers.withdraw')} onPress={() => void act(o.id, 'withdraw')} />
                  )}
                </View>
              ) : null}
            </Card>
          );
        }}
        ListEmptyComponent={q.loading ? <Loading /> : q.error ? null : <EmptyState icon={FileSignature} title={t('offers.empty')} hint={t('offers.emptyHint')} />}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={() => void q.reload()} tintColor={colors.primary} />}
      />
    </Screen>
  );
}

export default function OffersScreen() {
  return (
    <AuthGate>
      <Offers />
    </AuthGate>
  );
}
