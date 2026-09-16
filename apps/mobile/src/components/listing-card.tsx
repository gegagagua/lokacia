import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ListingCard as ListingCardDto } from '@lokacia/contracts';
import { api } from '../lib/api';
import { t } from '../lib/i18n';
import { cardSubtitle, confirmedLabel, priceLabel } from '../lib/listing-format';
import { useAppTheme } from '../theme/theme';
import { radius, space } from '../theme/tokens';
import { SpacePlan } from './space-plan';
import { Badge, Txt } from './ui';

export function ListingCard({ item, trailing }: { item: ListingCardDto; trailing?: React.ReactNode }) {
  const { colors } = useAppTheme();
  const cover = api.asset(item.cover);
  const confirmed = confirmedLabel(item.lastConfirmedAt);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${item.title}, ${priceLabel(item)}`}
      onPress={() => router.push(`/listing/${item.id}`)}
      style={({ pressed }) => ({ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', opacity: pressed ? 0.9 : 1 })}
    >
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: '42%', backgroundColor: colors.surface2, justifyContent: 'center' }}>
          {cover ? (
            <Image source={{ uri: cover }} style={{ width: '100%', height: '100%', minHeight: 132 }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
          ) : (
            <SpacePlan compact areaM2={item.areaM2} widthM={item.passport.widthM} depthM={item.passport.depthM} />
          )}
        </View>
        <View style={{ flex: 1, padding: space(1.5), gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {item.vip ? <Badge label={t('listing.vip')} tone="accent" /> : null}
            {item.verifiedOwner ? <Badge label={t('listing.verified')} tone="success" /> : null}
          </View>
          <Txt weight="semibold" tabular>
            {priceLabel(item)}
          </Txt>
          <Txt variant="small" numberOfLines={2}>
            {item.title}
          </Txt>
          <Txt variant="small" color="textMuted" numberOfLines={1} tabular>
            {cardSubtitle(item)}
          </Txt>
          {confirmed ? (
            <Txt variant="small" color="textMuted" numberOfLines={1}>
              {confirmed}
            </Txt>
          ) : null}
          {trailing}
        </View>
      </View>
    </Pressable>
  );
}
