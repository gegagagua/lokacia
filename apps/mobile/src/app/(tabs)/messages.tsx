import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Image } from 'expo-image';
import { MessageSquare } from 'lucide-react-native';
import { formatDateKa } from '@lokacia/contracts';
import { AuthGate } from '../../components/auth-gate';
import { Screen } from '../../components/screen';
import { Badge, EmptyState, ErrorBox, Loading, Txt } from '../../components/ui';
import { api, endpoints } from '../../lib/api';
import { errorMessage } from '../../lib/api-client';
import { t } from '../../lib/i18n';
import { useRealtime } from '../../lib/realtime';
import { useAsync } from '../../lib/use-async';
import { useAppTheme } from '../../theme/theme';
import { radius, space } from '../../theme/tokens';

function Conversations() {
  const { colors } = useAppTheme();
  const q = useAsync(() => endpoints.conversations(), [], { pollMs: 30_000 });
  useRealtime(true, { message: () => void q.reload({ silent: true }), read: () => void q.reload({ silent: true }) });
  useFocusEffect(
    useCallback(() => {
      void q.reload({ silent: true });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  return (
    <Screen>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: space(2), paddingBottom: space(6) }}
        ItemSeparatorComponent={() => <View style={{ height: space(1) }} />}
        ListHeaderComponent={
          <View style={{ paddingBottom: space(1.5) }}>
            <Txt variant="h2" weight="semibold" accessibilityRole="header">
              {t('messages.title')}
            </Txt>
            {q.error ? <ErrorBox message={errorMessage(q.error, t('common.networkError'))} onRetry={() => void q.reload()} /> : null}
          </View>
        }
        renderItem={({ item }) => {
          const cover = api.asset(item.listing?.cover);
          return (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(`/chat/${item.id}`)}
              style={({ pressed }) => ({ flexDirection: 'row', gap: space(1.5), padding: space(1.5), borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 })}
            >
              <View style={{ width: 56, height: 56, borderRadius: radius.photo, overflow: 'hidden', backgroundColor: colors.surface2 }}>
                {cover ? <Image source={{ uri: cover }} style={{ width: 56, height: 56 }} contentFit="cover" /> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(1) }}>
                  <Txt weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                    {item.other?.name ?? item.subject ?? ''}
                  </Txt>
                  {item.lastMessageAt ? (
                    <Txt variant="small" color="textMuted">
                      {formatDateKa(item.lastMessageAt)}
                    </Txt>
                  ) : null}
                </View>
                <Txt variant="small" color="textMuted" numberOfLines={1}>
                  {item.listing?.title ?? item.subject ?? ''}
                </Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
                  <Txt variant="small" numberOfLines={1} style={{ flex: 1 }} weight={item.unread ? 'semibold' : 'regular'}>
                    {item.lastMessage ? (item.lastMessage.mine ? t('messages.you', { body: item.lastMessage.body }) : item.lastMessage.body) : ''}
                  </Txt>
                  {item.unread ? <Badge label={String(item.unread)} tone="accent" /> : null}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={q.loading ? <Loading /> : q.error ? null : <EmptyState icon={MessageSquare} title={t('messages.empty')} hint={t('messages.emptyHint')} />}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={() => void q.reload()} tintColor={colors.primary} />}
      />
    </Screen>
  );
}

export default function MessagesTab() {
  return (
    <AuthGate>
      <Conversations />
    </AuthGate>
  );
}
