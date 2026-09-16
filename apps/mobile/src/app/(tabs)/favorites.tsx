import { FlatList, RefreshControl, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Heart } from 'lucide-react-native';
import { AuthGate } from '../../components/auth-gate';
import { ListingCard } from '../../components/listing-card';
import { Screen } from '../../components/screen';
import { Button, EmptyState, ErrorBox, Loading, Txt } from '../../components/ui';
import { endpoints } from '../../lib/api';
import { errorMessage } from '../../lib/api-client';
import { toggleFavorite } from '../../lib/favorites';
import { t } from '../../lib/i18n';
import { useAsync } from '../../lib/use-async';
import { useAppTheme } from '../../theme/theme';
import { space } from '../../theme/tokens';

function Favorites() {
  const { colors } = useAppTheme();
  const q = useAsync(() => endpoints.favorites(), []);
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
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: space(2), paddingBottom: space(6) }}
        ItemSeparatorComponent={() => <View style={{ height: space(1.5) }} />}
        ListHeaderComponent={
          <View style={{ paddingBottom: space(1.5) }}>
            <Txt variant="h2" weight="semibold" accessibilityRole="header">
              {t('favorites.title')}
            </Txt>
            {q.error ? <ErrorBox message={errorMessage(q.error, t('common.networkError'))} onRetry={() => void q.reload()} /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <ListingCard
            item={item}
            trailing={
              <Button
                kind="ghost"
                compact
                icon={Heart}
                title={t('favorites.remove')}
                style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
                onPress={async () => {
                  q.setData((prev) => prev?.filter((f) => f.id !== item.id));
                  await toggleFavorite(item.id).catch(() => void q.reload({ silent: true }));
                }}
              />
            }
          />
        )}
        ListEmptyComponent={q.loading ? <Loading /> : q.error ? null : <EmptyState icon={Heart} title={t('favorites.empty')} hint={t('favorites.emptyHint')} action={<Button title={t('favorites.browse')} onPress={() => router.navigate('/')} />} />}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={() => void q.reload()} tintColor={colors.primary} />}
      />
    </Screen>
  );
}

export default function FavoritesTab() {
  return (
    <AuthGate>
      <Favorites />
    </AuthGate>
  );
}
