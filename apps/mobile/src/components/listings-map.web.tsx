import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { MapPinned } from 'lucide-react-native';
import { formatArea, formatMoney } from '@lokacia/contracts';
import { t } from '../lib/i18n';
import { useAppTheme } from '../theme/theme';
import { radius, space } from '../theme/tokens';
import type { ListingsMapProps } from './listings-map';
import { Card, Txt } from './ui';

/** Web preview fallback: MapLibre RN is native-only, so the map tab shows the pins as a list. */
export function ListingsMap({ pins, onSelect }: ListingsMapProps) {
  const { colors } = useAppTheme();
  return (
    <FlatList
      data={pins}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: space(2), gap: space(1) }}
      ListHeaderComponent={
        <Card style={{ flexDirection: 'row', gap: space(1.5), alignItems: 'center', marginBottom: space(1) }}>
          <MapPinned size={24} color={colors.primary} strokeWidth={1.5} />
          <Txt variant="small" style={{ flex: 1 }}>
            {t('map.webFallback')}
          </Txt>
        </Card>
      }
      renderItem={({ item }) => (
        <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: space(1.5), gap: 2 }}>
          <Txt
            weight="medium"
            numberOfLines={1}
            onPress={() => {
              onSelect(item);
              router.push(`/listing/${item.id}`);
            }}
            accessibilityRole="link"
          >
            {item.title}
          </Txt>
          <Txt variant="small" color="textMuted" tabular>
            {`${formatMoney(item.priceMinor)} · ${formatArea(item.areaM2)} · ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`}
          </Txt>
        </View>
      )}
    />
  );
}
