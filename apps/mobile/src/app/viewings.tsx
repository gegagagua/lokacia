import { FlatList, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { CalendarClock } from 'lucide-react-native';
import { VIEWING_STATUS_LABELS_KA, formatDateTimeKa } from '@lokacia/contracts';
import { AuthGate } from '../components/auth-gate';
import { Screen } from '../components/screen';
import { Badge, Button, Card, EmptyState, ErrorBox, Loading, Txt } from '../components/ui';
import { endpoints, type ViewingDto } from '../lib/api';
import { errorMessage } from '../lib/api-client';
import { t } from '../lib/i18n';
import { useAsync } from '../lib/use-async';
import { useAppTheme } from '../theme/theme';
import { space } from '../theme/tokens';

function Viewings() {
  const { colors } = useAppTheme();
  const q = useAsync(() => endpoints.viewings(), []);
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } finally {
      await q.reload({ silent: true });
    }
  };
  const tone = (s: ViewingDto['status']) => (s === 'confirmed' ? 'success' : s === 'cancelled' ? 'danger' : 'neutral');
  return (
    <Screen edges={['bottom']}>
      {q.error ? <ErrorBox message={errorMessage(q.error, t('common.networkError'))} onRetry={() => void q.reload()} /> : null}
      <FlatList
        data={q.data ?? []}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: space(2), gap: space(1.5), paddingBottom: space(6) }}
        renderItem={({ item }) => {
          const upcoming = new Date(item.startsAt).getTime() > Date.now();
          return (
            <Card style={{ gap: space(1) }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(1) }}>
                <Txt weight="semibold" tabular style={{ flex: 1 }}>
                  {formatDateTimeKa(item.startsAt)}
                </Txt>
                <Badge label={VIEWING_STATUS_LABELS_KA[item.status]} tone={tone(item.status)} />
              </View>
              <Txt numberOfLines={2} onPress={() => router.push(`/listing/${item.listing.id}`)} accessibilityRole="link">
                {item.listing.title}
              </Txt>
              <Txt variant="small" color="textMuted">
                {[item.listing.address, item.mode === 'video' ? t('viewings.video') : t('viewings.onsite'), item.myRole === 'host' ? t('viewings.host') : t('viewings.visitor')].join(' · ')}
              </Txt>
              {upcoming && item.status !== 'cancelled' && item.status !== 'done' ? (
                <View style={{ flexDirection: 'row', gap: space(1) }}>
                  {item.myRole === 'host' && item.status === 'requested' ? <Button compact title={t('viewings.confirm')} onPress={() => void act(() => endpoints.confirmViewing(item.id))} /> : null}
                  <Button compact kind="secondary" title={t('viewings.cancel')} onPress={() => void act(() => endpoints.cancelViewing(item.id))} />
                </View>
              ) : null}
            </Card>
          );
        }}
        ListEmptyComponent={q.loading ? <Loading /> : q.error ? null : <EmptyState icon={CalendarClock} title={t('viewings.empty')} hint={t('viewings.emptyHint')} />}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={() => void q.reload()} tintColor={colors.primary} />}
      />
    </Screen>
  );
}

export default function ViewingsScreen() {
  return (
    <AuthGate>
      <Viewings />
    </AuthGate>
  );
}
