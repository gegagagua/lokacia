import { useState } from 'react';
import { FlatList, Linking, RefreshControl, Share, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarPlus, FileSignature, Heart, MapPin, MessageSquare, Phone, Share2 } from 'lucide-react-native';
import { formatArea, formatNumber } from '@lokacia/contracts';
import { Screen } from '../../components/screen';
import { SpacePlan } from '../../components/space-plan';
import { Badge, Button, Card, Divider, ErrorBox, IconButton, Loading, Section, Txt } from '../../components/ui';
import { api, endpoints } from '../../lib/api';
import { ApiError, errorMessage } from '../../lib/api-client';
import { toggleFavorite, useFavoriteIds } from '../../lib/favorites';
import { t } from '../../lib/i18n';
import { cardSubtitle, confirmedLabel, passportRows, priceLabel, pricePerM2Label } from '../../lib/listing-format';
import { useSession } from '../../lib/session';
import { useAsync } from '../../lib/use-async';
import { useAppTheme } from '../../theme/theme';
import { radius, space } from '../../theme/tokens';

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(2), paddingVertical: space(1) }}>
      <Txt color="textMuted" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt weight="medium" tabular style={{ textAlign: 'right' }}>
        {value}
      </Txt>
    </View>
  );
}

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { user } = useSession();
  const favs = useFavoriteIds(!!user);
  const q = useAsync(() => endpoints.listing(id), [id]);
  const [phone, setPhone] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const requireLogin = (fn: () => void) => () => (user ? fn() : router.push('/login'));

  if (q.loading)
    return (
      <Screen edges={[]}>
        <Loading />
      </Screen>
    );
  if (q.error || !q.data)
    return (
      <Screen edges={[]}>
        <ErrorBox message={q.error instanceof ApiError && q.error.status === 404 ? t('listing.notFound') : errorMessage(q.error, t('common.networkError'))} onRetry={() => void q.reload()} />
      </Screen>
    );

  const l = q.data;
  const photos = l.media.filter((m) => m.kind === 'photo' || m.kind === 'plan');
  const fav = favs.has(l.id);
  const rows = passportRows(l.passport);
  const confirmed = confirmedLabel(l.lastConfirmedAt);
  const perM2 = pricePerM2Label(l);

  const reveal = async () => {
    setRevealing(true);
    try {
      const r = await endpoints.revealPhone(l.id);
      setPhone(r.phone);
    } catch (e) {
      setNotice(errorMessage(e, t('listing.revealError')));
    } finally {
      setRevealing(false);
    }
  };

  const message = async () => {
    try {
      const conv = await endpoints.startConversation(l.id, t('listing.messagePrefill'));
      router.push(`/chat/${conv.conversationId}`);
    } catch (e) {
      setNotice(errorMessage(e, t('common.error')));
    }
  };

  return (
    <Screen edges={[]}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconButton icon={Share2} label="lokacia.ge" onPress={() => void Share.share({ message: `${l.title} — https://lokacia.ge/listings/${l.slug}` })} />
              <IconButton
                icon={Heart}
                active={fav}
                label={fav ? t('listing.unfavorite') : t('listing.favorite')}
                onPress={requireLogin(() => void toggleFavorite(l.id).catch((e: unknown) => setNotice(errorMessage(e, t('common.error')))))}
              />
            </View>
          ),
        }}
      />
      <FlatList
        data={[0]}
        keyExtractor={(k) => String(k)}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={() => void q.reload()} tintColor={colors.primary} />}
        renderItem={() => (
          <View style={{ paddingBottom: space(6) }}>
            {photos.length ? (
              <View>
                <FlatList
                  data={photos}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(m) => m.id}
                  onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
                  renderItem={({ item }) => (
                    <Image source={{ uri: api.asset(item.variants?.lg ?? item.url) ?? undefined }} style={{ width, height: width * 0.66, backgroundColor: colors.surface2 }} contentFit="cover" accessibilityLabel={item.alt ?? l.title} />
                  )}
                />
                <View style={{ position: 'absolute', right: space(1.5), bottom: space(1.5), backgroundColor: colors.overlay, borderRadius: radius.photo, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Txt variant="small" style={{ color: '#F7F9F5' }} tabular>{`${page + 1} / ${photos.length}`}</Txt>
                </View>
              </View>
            ) : (
              <Txt color="textMuted" style={{ padding: space(2) }}>
                {t('listing.noPhotos')}
              </Txt>
            )}
            <View style={{ padding: space(2), gap: space(2) }}>
              <View style={{ gap: space(0.5) }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {l.status !== 'active' ? <Badge label={t('listing.draft')} tone="danger" /> : null}
                  {l.vip ? <Badge label={t('listing.vip')} tone="accent" /> : null}
                  {l.verifiedOwner ? <Badge label={t('listing.verified')} tone="success" /> : null}
                  <Badge label={l.isOwner ? t('listing.owner') : t('listing.broker')} />
                  {!l.isOwner && l.commissionPct ? <Badge label={t('listing.commission', { pct: formatNumber(l.commissionPct) })} /> : null}
                </View>
                <Txt variant="h2" weight="semibold" tabular accessibilityRole="header">
                  {priceLabel(l)}
                </Txt>
                {perM2 ? (
                  <Txt color="textMuted" tabular>
                    {perM2}
                  </Txt>
                ) : null}
                <Txt variant="h3" weight="medium">
                  {l.title}
                </Txt>
                <Txt color="textMuted" tabular>
                  {cardSubtitle(l)}
                </Txt>
                {confirmed ? (
                  <Txt variant="small" color="success">
                    {confirmed}
                  </Txt>
                ) : null}
              </View>

              <View style={{ gap: space(1) }}>
                <Button icon={CalendarPlus} title={t('listing.book')} onPress={requireLogin(() => router.push(`/book/${l.id}`))} />
                <View style={{ flexDirection: 'row', gap: space(1) }}>
                  <Button style={{ flex: 1 }} kind="secondary" icon={FileSignature} title={t('listing.offer')} onPress={requireLogin(() => router.push(`/offer/${l.id}`))} />
                  <Button style={{ flex: 1 }} kind="secondary" icon={MessageSquare} title={t('listing.message')} onPress={requireLogin(() => void message())} />
                </View>
                {notice ? (
                  <Txt variant="small" color="danger" accessibilityLiveRegion="polite">
                    {notice}
                  </Txt>
                ) : null}
              </View>

              <Section title={t('listing.plan')}>
                <Card style={{ padding: space(1) }}>
                  <SpacePlan areaM2={l.areaM2} widthM={l.passport.widthM} depthM={l.passport.depthM} outline={l.passport.outline} ceilingM={l.passport.ceilingM} powerKw={l.passport.powerKw} />
                </Card>
              </Section>

              <Section title={t('listing.passport')}>
                <Card style={{ paddingVertical: space(0.5) }}>
                  <SpecRow label={t('listing.area')} value={formatArea(l.areaM2)} />
                  {l.floor !== null ? (
                    <>
                      <Divider />
                      <SpecRow label={t('listing.floor')} value={l.floorsTotal ? t('listing.floorOf', { floor: l.floor, total: l.floorsTotal }) : String(l.floor)} />
                    </>
                  ) : null}
                  {rows.map((r) => (
                    <View key={r.key}>
                      <Divider />
                      <SpecRow label={r.label} value={r.value} />
                    </View>
                  ))}
                  {l.depositMonths ? (
                    <>
                      <Divider />
                      <SpecRow label={t('listing.deposit')} value={t('listing.depositMonths', { n: formatNumber(l.depositMonths, 1) })} />
                    </>
                  ) : null}
                  <Divider />
                  <SpecRow label={t('listing.utilities')} value={l.utilitiesIncluded ? t('common.yes') : t('common.no')} />
                </Card>
              </Section>

              {l.description ? (
                <Section title={t('listing.description')}>
                  <Txt>{l.description}</Txt>
                </Section>
              ) : null}

              <Section title={t('listing.address')}>
                <View style={{ flexDirection: 'row', gap: space(1), alignItems: 'flex-start' }}>
                  <MapPin size={20} color={colors.link} strokeWidth={1.5} />
                  <Txt style={{ flex: 1 }}>{[l.address, l.districtName].filter(Boolean).join(', ')}</Txt>
                </View>
              </Section>

              <Section title={t('listing.contact')}>
                <Card style={{ gap: space(1) }}>
                  <Txt weight="semibold">{l.contact.name}</Txt>
                  <Txt color="textMuted">{[l.contact.kind === 'owner' ? t('listing.owner') : t('listing.broker'), l.contact.orgName].filter(Boolean).join(' · ')}</Txt>
                  {phone ? (
                    <Button icon={Phone} title={t('listing.call', { phone })} onPress={() => void Linking.openURL(`tel:${phone}`)} />
                  ) : (
                    <Button kind="secondary" icon={Phone} loading={revealing} title={t('listing.reveal')} onPress={() => void reveal()} />
                  )}
                </Card>
              </Section>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}
