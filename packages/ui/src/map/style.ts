import type { StyleSpecification } from 'maplibre-gl';

/**
 * Brand basemap (BRAND.md: plaster city, green parks, blue rivers, yellow pins).
 * With a MapTiler key we use the vector "dataviz" style recolored at runtime; otherwise OSM raster tiles
 * desaturated and tinted toward plaster (light) or basalt (dark).
 */
export function mapStyle(opts: { dark?: boolean; maptilerKey?: string }): StyleSpecification | string {
  if (opts.maptilerKey) {
    return `https://api.maptiler.com/maps/${opts.dark ? 'dataviz-dark' : 'dataviz-light'}/style.json?key=${opts.maptilerKey}`;
  }
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': opts.dark ? '#17201D' : '#EDF0EB' } },
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
        paint: opts.dark
          ? { 'raster-saturation': -0.85, 'raster-brightness-min': 0, 'raster-brightness-max': 0.42, 'raster-contrast': 0.1, 'raster-opacity': 0.9 }
          : { 'raster-saturation': -0.7, 'raster-brightness-min': 0.28, 'raster-contrast': -0.12, 'raster-hue-rotate': 20, 'raster-opacity': 0.9 },
      },
    ],
  };
}

export const TBILISI_CENTER: [number, number] = [44.7925, 41.7151];
