import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { formatArea, formatMoney } from '@lokacia/contracts';
import { ListingsMap } from '../../components/listings-map';
import { Screen } from '../../components/screen';
import { Button, IconButton, Txt } from '../../components/ui';
import { endpoints, type MapPin } from '../../lib/api';
import { t } from '../../lib/i18n';
import { bboxParam } from '../../lib/map-style';
import { searchFilters, searchQuery } from '../../lib/search-filters';
import { useAppTheme } from '../../theme/theme';
import { radius, space } from '../../theme/tokens';

export default function MapScreen() {
  const { colors } = useAppTheme();
  const filters = useSyncExternalStore(searchFilters.subscribe, searchFilters.get, searchFilters.get);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [selected, setSelected] = useState<MapPin | null>(null);
  const bbox = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const q = searchQuery(filters, { limit: 500 });
    if (bbox.current) q.set('bbox', bbox.current);
    try {
      setPins(await endpoints.mapPins(q));
    } catch {
      /* keep previous pins while offline */
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const onBoundsChange = (b: [number, number, number, number]) => {
    bbox.current = bboxParam(b);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(), 350);
  };

  return (
    <Screen>
      <View style={{ paddingHorizontal: space(2), paddingVertical: space(1), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt variant="h3" weight="semibold" accessibilityRole="header">
          {t('map.title')}
        </Txt>
        <Txt variant="small" color="textMuted" tabular>
          {t('map.pins', { n: pins.length })}
        </Txt>
      </View>
      <ListingsMap pins={pins} onBoundsChange={onBoundsChange} onSelect={setSelected} />
      {selected ? (
        <View style={{ position: 'absolute', left: space(2), right: space(2), bottom: space(2), backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space(2), gap: space(1) }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space(1) }}>
            <Pressable style={{ flex: 1 }} onPress={() => router.push(`/listing/${selected.id}`)} accessibilityRole="link">
              <Txt weight="semibold" tabular>{`${formatMoney(selected.priceMinor)} · ${formatArea(selected.areaM2)}`}</Txt>
              <Txt variant="small" numberOfLines={2}>
                {selected.title}
              </Txt>
            </Pressable>
            <IconButton icon={X} label={t('common.close')} onPress={() => setSelected(null)} />
          </View>
          <Button compact title={t('map.open')} onPress={() => router.push(`/listing/${selected.id}`)} />
        </View>
      ) : null}
    </Screen>
  );
}
