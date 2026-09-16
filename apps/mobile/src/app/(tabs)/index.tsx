import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SlidersHorizontal, SearchX, Sparkles } from 'lucide-react-native';
import { SEARCH_SORTS, SEARCH_SORT_LABELS_KA, type ListingCard as ListingCardDto } from '@lokacia/contracts';
import { ListingCard } from '../../components/listing-card';
import { Screen } from '../../components/screen';
import { Button, Chip, EmptyState, ErrorBox, Loading, Txt } from '../../components/ui';
import { endpoints } from '../../lib/api';
import { errorMessage } from '../../lib/api-client';
import { t } from '../../lib/i18n';
import { activeFilterCount, mergeParsed, searchFilters, searchQuery } from '../../lib/search-filters';
import { businessTypesStore, loadTaxonomy } from '../../lib/taxonomy';
import { useAppTheme } from '../../theme/theme';
import { fonts, radius, space } from '../../theme/tokens';
import { TextInput } from 'react-native';

const PAGE = 20;

export default function SearchScreen() {
  const { colors } = useAppTheme();
  const filters = useSyncExternalStore(searchFilters.subscribe, searchFilters.get, searchFilters.get);
  const types = useSyncExternalStore(businessTypesStore.subscribe, businessTypesStore.get, businessTypesStore.get);
  const [items, setItems] = useState<ListingCardDto[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void loadTaxonomy();
  }, []);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      try {
        const page = await endpoints.search(searchQuery(filters, { limit: PAGE }));
        setItems(page.items);
        setTotal(page.total);
        setCursor(page.nextCursor);
        setError(null);
      } catch (e) {
        setError(errorMessage(e, t('common.networkError')));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const loadMore = async () => {
    if (!cursor || more) return;
    setMore(true);
    try {
      const page = await endpoints.search(searchQuery(filters, { limit: PAGE, cursor }));
      setItems((prev) => [...prev, ...page.items.filter((i) => !prev.some((p) => p.id === i.id))]);
      setCursor(page.nextCursor);
    } catch {
      /* keep the list; user can pull to refresh */
    } finally {
      setMore(false);
    }
  };

  const parse = async () => {
    if (text.trim().length < 2) return;
    setParsing(true);
    setNotice(null);
    try {
      const r = await endpoints.parse(text.trim());
      searchFilters.set((f) => mergeParsed(f, r.filters));
      setNotice(t('search.parsed'));
    } catch (e) {
      setNotice(errorMessage(e, t('common.error')));
    } finally {
      setParsing(false);
    }
  };

  const count = activeFilterCount(filters);

  const header = (
    <View style={{ gap: space(1.5), paddingBottom: space(1) }}>
      <Txt variant="h2" weight="semibold" accessibilityRole="header">
        {t('search.title')}
      </Txt>
      <View style={{ flexDirection: 'row', gap: space(1) }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => void parse()}
          returnKeyType="search"
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('search.ask')}
          style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.button, paddingHorizontal: space(1.5), backgroundColor: colors.surface, color: colors.text, fontFamily: fonts.regular, fontSize: 15 }}
        />
        <Button title={t('search.ask')} icon={Sparkles} loading={parsing} onPress={() => void parse()} accessibilityLabel={t('search.ask')} style={{ paddingHorizontal: space(1.5) }} />
      </View>
      {notice ? (
        <Txt variant="small" color="textMuted" accessibilityLiveRegion="polite">
          {notice}
        </Txt>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(1) }}>
        <Chip label={t('search.all')} selected={!filters.businessType} onPress={() => searchFilters.set((f) => ({ ...f, businessType: undefined }))} />
        {types.map((b) => (
          <Chip key={b.slug} label={b.nameKa} selected={filters.businessType === b.slug} onPress={() => searchFilters.set((f) => ({ ...f, businessType: f.businessType === b.slug ? undefined : b.slug }))} />
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(1) }}>
        <Txt color="textMuted" tabular accessibilityLiveRegion="polite">
          {loading ? t('common.loading') : t('search.results', { n: total })}
        </Txt>
        <Button kind="secondary" compact icon={SlidersHorizontal} title={count ? t('search.filtersCount', { n: count }) : t('search.filters')} onPress={() => router.push('/filters')} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(1) }}>
        {SEARCH_SORTS.filter((s) => s !== 'score_desc').map((s) => (
          <Chip key={s} label={SEARCH_SORT_LABELS_KA[s]} selected={(filters.sort ?? 'relevance') === s} onPress={() => searchFilters.set((f) => ({ ...f, sort: s === 'relevance' ? undefined : s }))} />
        ))}
      </ScrollView>
      {error ? <ErrorBox message={error} onRetry={() => void load('initial')} /> : null}
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={loading ? [] : items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <ListingCard item={item} />}
        ItemSeparatorComponent={() => <View style={{ height: space(1.5) }} />}
        contentContainerStyle={{ padding: space(2), paddingBottom: space(6) }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : error ? null : (
            <EmptyState icon={SearchX} title={t('search.empty')} hint={t('search.emptyHint')} action={<Button kind="secondary" title={t('search.reset')} onPress={() => searchFilters.set({})} />} />
          )
        }
        ListFooterComponent={more ? <Loading /> : null}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={colors.primary} />}
      />
    </Screen>
  );
}
