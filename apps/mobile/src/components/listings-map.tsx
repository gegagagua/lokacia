import { useMemo, useRef } from 'react';
import { View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { LocateFixed } from 'lucide-react-native';
import * as Location from 'expo-location';
import type { MapPin } from '../lib/api';
import { t } from '../lib/i18n';
import { TBILISI_CENTER, mapStyle, pinsToGeoJSON } from '../lib/map-style';
import { useAppTheme } from '../theme/theme';
import { radius, space } from '../theme/tokens';
import { IconButton } from './ui';

export type ListingsMapProps = {
  pins: MapPin[];
  onBoundsChange: (bounds: [number, number, number, number]) => void;
  onSelect: (pin: MapPin) => void;
};

/** Native map (MapLibre — BRAND.md, no Google Maps). Clustered yellow pins; web uses listings-map.web.tsx. */
export function ListingsMap({ pins, onBoundsChange, onSelect }: ListingsMapProps) {
  const { dark, colors } = useAppTheme();
  const camera = useRef<CameraRef>(null);
  const data = useMemo(() => pinsToGeoJSON(pins), [pins]);
  const byId = useMemo(() => new globalThis.Map(pins.map((p) => [p.id, p])), [pins]);
  const style = useMemo(() => mapStyle(dark), [dark]);

  const locate = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    camera.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 });
  };

  return (
    <View style={{ flex: 1 }}>
      <Map
        style={{ flex: 1 }}
        mapStyle={style}
        logo={false}
        attribution
        compass={false}
        onRegionDidChange={(e) => onBoundsChange(e.nativeEvent.bounds)}
      >
        <Camera ref={camera} initialViewState={{ center: TBILISI_CENTER, zoom: 11.5 }} />
        <GeoJSONSource
          id="listings"
          data={data}
          cluster
          clusterRadius={40}
          onPress={(e) => {
            const f = e.nativeEvent.features[0];
            const id = f?.properties?.id as string | undefined;
            const pin = id ? byId.get(id) : undefined;
            if (pin) onSelect(pin);
            else if (f?.geometry.type === 'Point') camera.current?.easeTo({ center: f.geometry.coordinates as [number, number], zoom: 14 });
          }}
        >
          <Layer id="clusters" type="circle" filter={['has', 'point_count']} paint={{ 'circle-color': colors.primary, 'circle-radius': ['step', ['get', 'point_count'], 16, 20, 20, 100, 26], 'circle-stroke-width': 2, 'circle-stroke-color': colors.surface }} />
          <Layer id="cluster-count" type="symbol" filter={['has', 'point_count']} layout={{ 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 }} paint={{ 'text-color': colors.primaryContrast }} />
          <Layer id="pins" type="circle" filter={['!', ['has', 'point_count']]} paint={{ 'circle-color': colors.sulfur, 'circle-radius': ['case', ['==', ['get', 'vip'], 1], 9, 7], 'circle-stroke-width': 2, 'circle-stroke-color': colors.surface }} />
        </GeoJSONSource>
      </Map>
      <View style={{ position: 'absolute', right: space(2), bottom: space(2), backgroundColor: colors.surface, borderRadius: radius.button, borderWidth: 1, borderColor: colors.border }}>
        <IconButton icon={LocateFixed} label={t('map.myLocation')} onPress={() => void locate()} />
      </View>
    </View>
  );
}
