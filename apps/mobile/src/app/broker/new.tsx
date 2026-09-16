import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { router } from 'expo-router';
import { Camera, CheckCircle2, ImagePlus, LocateFixed, Mic, Play, ScanLine, Square, Trash2, X } from 'lucide-react-native';
import { DEAL_TYPES, DEAL_TYPE_LABELS_KA, type DealType } from '@lokacia/contracts';
import { AuthGate } from '../../components/auth-gate';
import { Screen } from '../../components/screen';
import { Button, Card, Chip, EmptyState, Field, IconButton, Section, Txt } from '../../components/ui';
import { api, endpoints } from '../../lib/api';
import { errorMessage } from '../../lib/api-client';
import { buildDraftListing, mediaMeta, type Coords } from '../../lib/broker-draft';
import { t } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { businessTypesStore, loadTaxonomy } from '../../lib/taxonomy';
import { useAppTheme } from '../../theme/theme';
import { radius, space } from '../../theme/tokens';

type Photo = { uri: string; name: string; type: string };
type Voice = { uri: string; seconds: number };

function BrokerCapture() {
  const { colors } = useAppTheme();
  const { agencyOrgs } = useSession();
  const types = useSyncExternalStore(businessTypesStore.subscribe, businessTypesStore.get, businessTypesStore.get);
  const [orgId, setOrgId] = useState<string | null>(agencyOrgs[0]?.id ?? null);
  const [businessType, setBusinessType] = useState('office');
  const [dealType, setDealType] = useState<DealType>('rent');
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [voice, setVoice] = useState<Voice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 500);
  const player = useAudioPlayer(voice?.uri ?? null);

  useEffect(() => {
    void loadTaxonomy();
  }, []);

  if (!agencyOrgs.length)
    return (
      <Screen>
        <EmptyState title={t('broker.noOrg')} />
      </Screen>
    );

  const locate = async () => {
    setError(null);
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return setError(t('broker.locationDenied'));
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      if (!address) {
        const [place] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }).catch(() => []);
        if (place) setAddress([place.city, place.street, place.streetNumber].filter(Boolean).join(', '));
      }
    } catch (e) {
      setError(errorMessage(e, t('common.error')));
    } finally {
      setLocating(false);
    }
  };

  const addAssets = (assets: ImagePicker.ImagePickerAsset[]) =>
    setPhotos((prev) => [...prev, ...assets.map((a) => ({ uri: a.uri, ...mediaMeta(a.uri, 'image', a.mimeType, a.fileName) }))].slice(0, 40));

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError(t('broker.cameraDenied'));
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8, exif: false });
    if (!r.canceled) addAssets(r.assets);
  };

  const pickPhotos = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8, selectionLimit: 20 });
    if (!r.canceled) addAssets(r.assets);
  };

  const startRecording = async () => {
    setError(null);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return setError(t('broker.micDenied'));
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stopRecording = async () => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    const uri = recorder.uri;
    if (uri) setVoice({ uri, seconds: Math.round(rec.durationMillis / 1000) });
  };

  const save = async () => {
    setError(null);
    const body = buildDraftListing({ businessType, dealType, title, address, area, price, note }, coords);
    if (!body || !orgId) return setError(t('broker.required'));
    const total = 1 + photos.length + (voice ? 1 : 0);
    setProgress({ done: 0, total });
    try {
      const listing = await endpoints.createDraftListing(orgId, body);
      let done = 1;
      setProgress({ done, total });
      for (const p of photos) {
        await api.upload({ uri: p.uri, name: p.name, type: p.type, kind: 'photo', listingId: listing.id });
        setProgress({ done: ++done, total });
      }
      if (voice) {
        const meta = mediaMeta(voice.uri, 'audio');
        await api.upload({ uri: voice.uri, name: meta.name, type: meta.type, kind: 'document', listingId: listing.id });
        setProgress({ done: ++done, total });
      }
      setSavedId(listing.id);
    } catch (e) {
      setError(errorMessage(e, t('common.networkError')));
    } finally {
      setProgress(null);
    }
  };

  if (savedId)
    return (
      <Screen>
        <EmptyState
          icon={CheckCircle2}
          title={t('broker.saved')}
          action={
            <View style={{ gap: space(1), alignSelf: 'stretch' }}>
              <Button title={t('broker.openDraft')} onPress={() => router.push(`/listing/${savedId}`)} />
              <Button
                kind="secondary"
                title={t('broker.another')}
                onPress={() => {
                  setSavedId(null);
                  setTitle('');
                  setAddress('');
                  setArea('');
                  setPrice('');
                  setNote('');
                  setPhotos([]);
                  setVoice(null);
                  setCoords(null);
                }}
              />
            </View>
          }
        />
      </Screen>
    );

  return (
    <Screen scroll edges={['bottom']}>
      {agencyOrgs.length > 1 ? (
        <Section title={t('broker.org')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1) }}>
            {agencyOrgs.map((o) => (
              <Chip key={o.id} label={o.name} selected={orgId === o.id} onPress={() => setOrgId(o.id)} />
            ))}
          </View>
        </Section>
      ) : (
        <Txt color="textMuted">{agencyOrgs[0]!.name}</Txt>
      )}

      <Section title={t('broker.businessType')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(1) }}>
          {types.map((b) => (
            <Chip key={b.slug} label={b.nameKa} selected={businessType === b.slug} onPress={() => setBusinessType(b.slug)} />
          ))}
        </ScrollView>
      </Section>
      <Section title={t('broker.dealType')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1) }}>
          {DEAL_TYPES.map((d) => (
            <Chip key={d} label={DEAL_TYPE_LABELS_KA[d]} selected={dealType === d} onPress={() => setDealType(d)} />
          ))}
        </View>
      </Section>

      <Field label={t('broker.listingTitle')} placeholder={t('broker.titlePlaceholder')} value={title} onChangeText={setTitle} maxLength={120} />
      <View style={{ flexDirection: 'row', gap: space(1) }}>
        <Field style={{ flex: 1 }} label={t('broker.area')} keyboardType="decimal-pad" value={area} onChangeText={setArea} />
        <Field style={{ flex: 1 }} label={t('broker.price')} keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
      </View>

      <Section title={t('broker.location')}>
        <Button kind="secondary" icon={LocateFixed} loading={locating} title={locating ? t('broker.locating') : t('broker.locate')} onPress={() => void locate()} />
        {coords ? (
          <Txt variant="small" color="textMuted" tabular>
            {t('broker.located', { lat: coords.lat.toFixed(5), lng: coords.lng.toFixed(5), acc: Math.round(coords.accuracy ?? 0) })}
          </Txt>
        ) : null}
        <Field label={t('broker.address')} value={address} onChangeText={setAddress} maxLength={200} />
      </Section>

      <Section title={t('broker.photos')}>
        <View style={{ flexDirection: 'row', gap: space(1) }}>
          <Button style={{ flex: 1 }} kind="secondary" icon={Camera} title={t('broker.takePhoto')} onPress={() => void takePhoto()} />
          <Button style={{ flex: 1 }} kind="secondary" icon={ImagePlus} title={t('broker.pickPhotos')} onPress={() => void pickPhotos()} />
        </View>
        {photos.length ? (
          <ScrollView horizontal contentContainerStyle={{ gap: space(1) }}>
            {photos.map((p) => (
              <View key={p.uri}>
                <Image source={{ uri: p.uri }} style={{ width: 88, height: 88, borderRadius: radius.photo }} contentFit="cover" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  onPress={() => setPhotos((prev) => prev.filter((x) => x.uri !== p.uri))}
                  style={{ position: 'absolute', top: 2, right: 2, backgroundColor: colors.overlay, borderRadius: 12, padding: 2 }}
                >
                  <X size={16} color="#F7F9F5" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </Section>

      <Section title={t('broker.voice')}>
        <Card style={{ gap: space(1) }}>
          {rec.isRecording ? (
            <>
              <Txt color="danger" tabular accessibilityLiveRegion="polite">
                {t('broker.recording', { s: Math.round(rec.durationMillis / 1000) })}
              </Txt>
              <Button kind="danger" icon={Square} title={t('broker.stop')} onPress={() => void stopRecording()} />
            </>
          ) : voice ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
              <Txt style={{ flex: 1 }} tabular>
                {t('broker.recorded', { s: voice.seconds })}
              </Txt>
              <IconButton
                icon={Play}
                label={t('broker.play')}
                onPress={() => {
                  player.seekTo(0);
                  player.play();
                }}
              />
              <IconButton icon={Trash2} label={t('broker.removeVoice')} onPress={() => setVoice(null)} />
            </View>
          ) : (
            <Button kind="secondary" icon={Mic} title={t('broker.record')} onPress={() => void startRecording()} />
          )}
        </Card>
        <Field label={t('broker.note')} value={note} onChangeText={setNote} multiline maxLength={5000} />
      </Section>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1), opacity: 0.7 }}>
        <ScanLine size={20} color={colors.textMuted} strokeWidth={1.5} />
        <Txt variant="small" color="textMuted">
          {t('broker.lidar')}
        </Txt>
      </View>

      {error ? (
        <Txt color="danger" accessibilityLiveRegion="assertive">
          {error}
        </Txt>
      ) : null}
      <Button title={progress ? t('broker.saving', { done: progress.done, total: progress.total }) : t('broker.submit')} loading={!!progress} onPress={() => void save()} />
    </Screen>
  );
}

export default function BrokerNewScreen() {
  return (
    <AuthGate>
      <BrokerCapture />
    </AuthGate>
  );
}
