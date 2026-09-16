import type { StyleSpecification } from '@maplibre/maplibre-react-native';

export const TBILISI_CENTER: [number, number] = [44.793, 41.715];

/**
 * Basemap (BRAND.md: plaster city, green parks, blue rivers, yellow pins; no Google Maps).
 * With `EXPO_PUBLIC_MAPTILER_KEY` → MapTiler vector style; otherwise OSM raster tinted toward the brand (dev only —
 * production needs MapTiler, see HUMAN_TODO #6).
 */
export function mapStyle(dark: boolean, maptilerKey = process.env.EXPO_PUBLIC_MAPTILER_KEY): string | StyleSpecification {
  if (maptilerKey) return `https://api.maptiler.com/maps/${dark ? 'dataviz-dark' : 'dataviz-light'}/style.json?key=${maptilerKey}`;
  return {
    version: 8,
    sources: {
      osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap', maxzoom: 19 },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': dark ? '#17201D' : '#EDF0EB' } },
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
        paint: dark ? { 'raster-saturation': -0.8, 'raster-brightness-max': 0.45, 'raster-contrast': 0.1 } : { 'raster-saturation': -0.55, 'raster-brightness-min': 0.12, 'raster-opacity': 0.9 },
      },
    ],
  };
}

/** Pins → GeoJSON FeatureCollection for a clustered source. */
export function pinsToGeoJSON(pins: readonly { id: string; lng: number; lat: number; priceMinor: number; vip: boolean }[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: pins
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => ({ type: 'Feature', id: p.id, geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, priceMinor: p.priceMinor, vip: p.vip ? 1 : 0 } })),
  };
}

export function bboxParam(bounds: readonly [number, number, number, number]): string {
  return bounds.map((n) => n.toFixed(5)).join(',');
}
