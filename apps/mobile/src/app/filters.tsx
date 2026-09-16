import { useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { DEAL_TYPES, DEAL_TYPE_LABELS_KA, type PassportKey, type SearchFilters } from '@lokacia/contracts';
import { Screen } from '../components/screen';
import { Button, Chip, Field, Section, ToggleRow } from '../components/ui';
import { t } from '../lib/i18n';
import { numberOrUndefined, searchFilters } from '../lib/search-filters';
import { businessTypesStore, districtsStore } from '../lib/taxonomy';
import { space } from '../theme/tokens';

const str = (n: number | undefined) => (n === undefined ? '' : String(n));

export default function FiltersScreen() {
  const current = useSyncExternalStore(searchFilters.subscribe, searchFilters.get, searchFilters.get);
  const types = useSyncExternalStore(businessTypesStore.subscribe, businessTypesStore.get, businessTypesStore.get);
  const districts = useSyncExternalStore(districtsStore.subscribe, districtsStore.get, districtsStore.get);
  const [draft, setDraft] = useState<SearchFilters>(current);
  const [priceMin, setPriceMin] = useState(str(current.priceMin));
  const [priceMax, setPriceMax] = useState(str(current.priceMax));
  const [areaMin, setAreaMin] = useState(str(current.areaMin));
  const [areaMax, setAreaMax] = useState(str(current.areaMax));

  const set = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const passportFilters = types.find((b) => b.slug === draft.businessType)?.filterConfig.filters ?? [];
  const tbilisi = districts.filter((d) => d.city === 'tbilisi');

  const apply = () => {
    searchFilters.set({ ...draft, priceMin: numberOrUndefined(priceMin), priceMax: numberOrUndefined(priceMax), areaMin: numberOrUndefined(areaMin), areaMax: numberOrUndefined(areaMax) });
    router.back();
  };

  return (
    <Screen scroll edges={['bottom']}>
      <Section title={t('filters.dealType')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1) }}>
          {DEAL_TYPES.map((d) => (
            <Chip key={d} label={DEAL_TYPE_LABELS_KA[d]} selected={draft.dealType === d} onPress={() => set('dealType', draft.dealType === d ? undefined : d)} />
          ))}
        </View>
      </Section>
      <Section title={t('filters.businessType')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1) }}>
          {types.map((b) => (
            <Chip key={b.slug} label={b.nameKa} selected={draft.businessType === b.slug} onPress={() => set('businessType', draft.businessType === b.slug ? undefined : b.slug)} />
          ))}
        </View>
      </Section>
      <Section title={t('filters.price')}>
        <View style={{ flexDirection: 'row', gap: space(1) }}>
          <Field style={{ flex: 1 }} label={t('filters.min')} keyboardType="number-pad" value={priceMin} onChangeText={setPriceMin} />
          <Field style={{ flex: 1 }} label={t('filters.max')} keyboardType="number-pad" value={priceMax} onChangeText={setPriceMax} />
        </View>
      </Section>
      <Section title={t('filters.area')}>
        <View style={{ flexDirection: 'row', gap: space(1) }}>
          <Field style={{ flex: 1 }} label={t('filters.min')} keyboardType="number-pad" value={areaMin} onChangeText={setAreaMin} />
          <Field style={{ flex: 1 }} label={t('filters.max')} keyboardType="number-pad" value={areaMax} onChangeText={setAreaMax} />
        </View>
      </Section>
      {tbilisi.length ? (
        <Section title={t('filters.districts')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1) }}>
            {tbilisi.map((d) => {
              const on = draft.districts?.includes(d.slug) ?? false;
              return <Chip key={d.slug} label={d.nameKa} selected={on} onPress={() => set('districts', on ? draft.districts?.filter((s) => s !== d.slug) : [...(draft.districts ?? []), d.slug])} />;
            })}
          </View>
        </Section>
      ) : null}
      <View>
        <ToggleRow label={t('filters.verifiedOnly')} value={!!draft.verifiedOnly} onValueChange={(v) => set('verifiedOnly', v || undefined)} />
        <ToggleRow label={t('filters.onlyOwners')} value={!!draft.onlyOwners} onValueChange={(v) => set('onlyOwners', v || undefined)} />
      </View>
      {passportFilters.length ? (
        <Section title={t('filters.passport')}>
          {passportFilters.map((f) => {
            const key = f.key as PassportKey;
            if (f.kind === 'boolean') return <ToggleRow key={key} label={f.labelKa} value={draft[key] === true} onValueChange={(v) => set(key, v || undefined)} />;
            return <Field key={key} label={`${f.labelKa}${f.unit ? `, ${f.unit}` : ''}`} keyboardType="decimal-pad" value={typeof draft[key] === 'number' ? String(draft[key]) : ''} onChangeText={(s) => set(key, numberOrUndefined(s))} />;
          })}
        </Section>
      ) : null}
      <View style={{ gap: space(1) }}>
        <Button title={t('filters.apply')} onPress={apply} />
        <Button
          kind="ghost"
          title={t('filters.reset')}
          onPress={() => {
            searchFilters.set({});
            router.back();
          }}
        />
      </View>
    </Screen>
  );
}
