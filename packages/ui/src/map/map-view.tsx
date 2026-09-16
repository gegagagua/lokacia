'use client';
import * as React from 'react';
import type { GeoJSONSource, Map as MlMap, Marker as MlMarker } from 'maplibre-gl';
import { cn } from '../lib/cn';
import { mapStyle, TBILISI_CENTER } from './style';

export type MapPoint = { id: string; lat: number; lng: number; label?: string; vip?: boolean; href?: string; title?: string };
export type MapPoi = { id: string; lat: number; lng: number; name: string; category: string };

export type MapViewProps = {
  center?: [number, number];
  zoom?: number;
  points?: MapPoint[];
  pois?: MapPoi[];
  polygons?: GeoJSON.FeatureCollection;
  /** property on polygon features used for choropleth; colors interpolate light→green */
  valueProperty?: string;
  valueStops?: [number, number];
  selectedId?: string | null;
  radiusM?: number;
  draggablePin?: { lat: number; lng: number } | null;
  onPinMove?: (p: { lat: number; lng: number }) => void;
  onPointClick?: (id: string) => void;
  onPolygonClick?: (props: Record<string, unknown>) => void;
  onBoundsChange?: (bbox: [number, number, number, number]) => void;
  onMapClick?: (p: { lat: number; lng: number }) => void;
  maptilerKey?: string;
  className?: string;
  ariaLabel?: string;
  fitToPoints?: boolean;
};

const POI_COLOR: Record<string, string> = { competitor: '#B4492F', transport: '#2F5FB8', school: '#1E4A42', business_center: '#17201D', parking: '#8A968F', bank: '#8A968F' };

function isDark() {
  if (typeof document === 'undefined') return false;
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function circlePolygon(lat: number, lng: number, radiusM: number, steps = 64): GeoJSON.Feature {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const dx = (radiusM * Math.cos(a)) / (111_320 * Math.cos((lat * Math.PI) / 180));
    const dy = (radiusM * Math.sin(a)) / 110_540;
    coords.push([lng + dx, lat + dy]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

/** MapLibre map with brand style, pin-drop markers (≤300) or clustered circles, choropleth, POIs, radius and draggable pin. */
export function MapView(props: MapViewProps) {
  const { center, zoom = 12, points = [], pois = [], polygons, valueProperty, valueStops = [0, 60], selectedId, radiusM, draggablePin, onPinMove, onPointClick, onPolygonClick, onBoundsChange, onMapClick, maptilerKey, className, ariaLabel = 'რუკა', fitToPoints } = props;
  const el = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<MlMap | null>(null);
  const markers = React.useRef<MlMarker[]>([]);
  const pin = React.useRef<MlMarker | null>(null);
  const [ready, setReady] = React.useState(false);
  const lib = React.useRef<typeof import('maplibre-gl') | null>(null);
  const cb = React.useRef({ onPointClick, onPolygonClick, onBoundsChange, onMapClick, onPinMove });
  cb.current = { onPointClick, onPolygonClick, onBoundsChange, onMapClick, onPinMove };

  React.useEffect(() => {
    let cancelled = false;
    void import('maplibre-gl').then((ml) => {
      if (cancelled || !el.current) return;
      lib.current = ml;
      const m = new ml.Map({ container: el.current, style: mapStyle({ dark: isDark(), maptilerKey }), center: center ?? TBILISI_CENTER, zoom, attributionControl: { compact: true }, cooperativeGestures: false });
      m.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      m.on('load', () => {
        m.addSource('points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 44, clusterMaxZoom: 14 });
        m.addLayer({ id: 'clusters', type: 'circle', source: 'points', filter: ['has', 'point_count'], paint: { 'circle-color': '#1E4A42', 'circle-radius': ['step', ['get', 'point_count'], 16, 20, 22, 100, 30], 'circle-stroke-color': '#EDF0EB', 'circle-stroke-width': 2 } });
        m.addLayer({ id: 'cluster-count', type: 'symbol', source: 'points', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Open Sans Semibold'] }, paint: { 'text-color': '#F7F9F5' } });
        m.addLayer({ id: 'point', type: 'circle', source: 'points', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': ['case', ['get', 'vip'], '#D8A31A', '#1E4A42'], 'circle-radius': 7, 'circle-stroke-color': '#EDF0EB', 'circle-stroke-width': 2 } });
        m.on('click', 'point', (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) cb.current.onPointClick?.(id);
        });
        m.on('click', 'clusters', async (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const zoomTo = await (m.getSource('points') as GeoJSONSource).getClusterExpansionZoom(f.properties!.cluster_id as number);
          m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoomTo });
        });
        for (const l of ['point', 'clusters']) {
          m.on('mouseenter', l, () => (m.getCanvas().style.cursor = 'pointer'));
          m.on('mouseleave', l, () => (m.getCanvas().style.cursor = ''));
        }
        m.addSource('radius', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': '#2F5FB8', 'fill-opacity': 0.06 } });
        m.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': '#2F5FB8', 'line-width': 1.5, 'line-dasharray': [3, 2] } });
        m.addSource('pois', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m.addLayer({ id: 'pois', type: 'circle', source: 'pois', paint: { 'circle-color': ['get', 'color'], 'circle-radius': 5, 'circle-stroke-color': '#F7F9F5', 'circle-stroke-width': 1.5 } });
        setReady(true);
      });
      m.on('moveend', () => {
        const b = m.getBounds();
        cb.current.onBoundsChange?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      });
      m.on('click', (e) => {
        if (m.queryRenderedFeatures(e.point, { layers: ['point', 'clusters'].filter((l) => m.getLayer(l)) }).length) return;
        cb.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
      map.current = m;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // points: HTML markers with pin-drop when few, clustered circles when many
  React.useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    if (!ready || !m || !ml) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    const src = m.getSource('points') as GeoJSONSource;
    if (points.length > 300) {
      src.setData({ type: 'FeatureCollection', features: points.map((p) => ({ type: 'Feature', properties: { id: p.id, vip: !!p.vip }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) });
    } else {
      src.setData({ type: 'FeatureCollection', features: [] });
      points.forEach((p, i) => {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'lk-pin animate-pin-drop';
        node.style.animationDelay = `${Math.min(i * 12, 600)}ms`;
        node.dataset.vip = String(!!p.vip);
        node.dataset.selected = String(p.id === selectedId);
        node.setAttribute('aria-label', p.title ?? p.label ?? 'ფართი');
        node.textContent = p.label ?? '';
        node.onclick = (e) => {
          e.stopPropagation();
          cb.current.onPointClick?.(p.id);
        };
        markers.current.push(new ml.Marker({ element: node, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(m));
      });
    }
    if (fitToPoints && points.length) {
      const b = new ml.LngLatBounds();
      points.forEach((p) => b.extend([p.lng, p.lat]));
      m.fitBounds(b, { padding: 60, maxZoom: 15, duration: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, points]);

  React.useEffect(() => {
    markers.current.forEach((mk) => {
      const node = mk.getElement();
      const p = points.find((x) => x.lat === mk.getLngLat().lat && x.lng === mk.getLngLat().lng);
      node.dataset.selected = String(!!p && p.id === selectedId);
    });
  }, [selectedId, points]);

  React.useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource('pois') as GeoJSONSource).setData({ type: 'FeatureCollection', features: pois.map((p) => ({ type: 'Feature', properties: { name: p.name, color: POI_COLOR[p.category] ?? '#8A968F' }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) });
  }, [ready, pois]);

  React.useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const c = draggablePin ?? (center ? { lat: center[1], lng: center[0] } : null);
    (m.getSource('radius') as GeoJSONSource).setData({ type: 'FeatureCollection', features: radiusM && c ? [circlePolygon(c.lat, c.lng, radiusM)] : [] });
  }, [ready, radiusM, center, draggablePin]);

  React.useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    if (!ready || !m || !ml) return;
    if (!draggablePin) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    if (!pin.current) {
      const node = document.createElement('div');
      node.className = 'lk-pin';
      node.dataset.selected = 'true';
      node.textContent = '●';
      pin.current = new ml.Marker({ element: node, draggable: true, anchor: 'bottom' }).setLngLat([draggablePin.lng, draggablePin.lat]).addTo(m);
      pin.current.on('dragend', () => {
        const ll = pin.current!.getLngLat();
        cb.current.onPinMove?.({ lat: ll.lat, lng: ll.lng });
      });
      m.easeTo({ center: [draggablePin.lng, draggablePin.lat], zoom: Math.max(m.getZoom(), 15) });
    } else pin.current.setLngLat([draggablePin.lng, draggablePin.lat]);
  }, [ready, draggablePin]);

  React.useEffect(() => {
    const m = map.current;
    if (!ready || !m || !polygons) return;
    const [lo, hi] = valueStops;
    if (m.getSource('polys')) (m.getSource('polys') as GeoJSONSource).setData(polygons);
    else {
      m.addSource('polys', { type: 'geojson', data: polygons, promoteId: 'id' });
      m.addLayer(
        { id: 'polys-fill', type: 'fill', source: 'polys', paint: { 'fill-color': valueProperty ? ['interpolate', ['linear'], ['coalesce', ['get', valueProperty], lo], lo, '#EDF0EB', (lo + hi) / 2, '#8FB8A8', hi, '#1E4A42'] : '#1E4A42', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.85, 0.62] } },
        'clusters',
      );
      m.addLayer({ id: 'polys-line', type: 'line', source: 'polys', paint: { 'line-color': '#17201D', 'line-width': 1, 'line-opacity': 0.6 } }, 'clusters');
      m.addLayer({ id: 'polys-label', type: 'symbol', source: 'polys', layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-font': ['Open Sans Semibold'] }, paint: { 'text-color': '#17201D', 'text-halo-color': '#EDF0EB', 'text-halo-width': 1.5 } });
      let hovered: string | number | undefined;
      m.on('mousemove', 'polys-fill', (e) => {
        if (hovered !== undefined) m.setFeatureState({ source: 'polys', id: hovered }, { hover: false });
        hovered = e.features?.[0]?.id;
        if (hovered !== undefined) m.setFeatureState({ source: 'polys', id: hovered }, { hover: true });
        m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', 'polys-fill', () => {
        if (hovered !== undefined) m.setFeatureState({ source: 'polys', id: hovered }, { hover: false });
        m.getCanvas().style.cursor = '';
      });
      m.on('click', 'polys-fill', (e) => {
        const p = e.features?.[0]?.properties;
        if (p) cb.current.onPolygonClick?.(p);
      });
    }
  }, [ready, polygons, valueProperty, valueStops]);

  return <div ref={el} role="region" aria-label={ariaLabel} className={cn('lk-map relative h-full min-h-64 w-full overflow-hidden rounded-card border border-border bg-surface-2', className)} />;
}
