/* eslint-disable no-console */
/**
 * OpenStreetMap POI import (PRODUCT.md P3, ROADMAP Phase 5 / V8).
 *
 *   pnpm --filter @lokacia/api import:osm                 # all cities
 *   pnpm --filter @lokacia/api import:osm -- tbilisi      # one city
 *   OSM_DRY_RUN=1 pnpm --filter @lokacia/api import:osm   # fetch + map, no writes
 *
 * Uses the public Overpass API (respect its usage policy: run rarely, off-peak; for production mirror
 * Geofabrik extracts — see docs/HUMAN_TODO.md). Upserts into `pois` by (source='osm', source_id).
 */
import { config } from 'dotenv';
import path from 'node:path';
import { createDb, pois, sql } from '@lokacia/db';

config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

type Category = 'competitor' | 'transport' | 'school' | 'business_center' | 'parking' | 'bank';

export const CITY_BBOX: Record<string, [number, number, number, number]> = {
  // south, west, north, east
  tbilisi: [41.64, 44.69, 41.83, 44.92],
  batumi: [41.59, 41.57, 41.68, 41.68],
  kutaisi: [42.23, 42.64, 42.31, 42.76],
  rustavi: [41.5, 44.97, 41.58, 45.08],
};

/** OSM tag → our category (+ business type for competitors). Order matters: first match wins. */
export const TAG_RULES: { match: (t: Record<string, string>) => boolean; category: Category; businessType?: string }[] = [
  { match: (t) => ['restaurant', 'cafe', 'fast_food', 'food_court'].includes(t.amenity ?? ''), category: 'competitor', businessType: 'cafe' },
  { match: (t) => ['bar', 'pub', 'nightclub'].includes(t.amenity ?? ''), category: 'competitor', businessType: 'bar' },
  { match: (t) => ['bakery', 'pastry', 'confectionery'].includes(t.shop ?? ''), category: 'competitor', businessType: 'bakery' },
  { match: (t) => t.amenity === 'pharmacy' || t.shop === 'chemist', category: 'competitor', businessType: 'pharmacy' },
  { match: (t) => ['hairdresser', 'beauty', 'cosmetics', 'massage'].includes(t.shop ?? ''), category: 'competitor', businessType: 'beauty-salon' },
  { match: (t) => ['clinic', 'dentist', 'doctors', 'hospital'].includes(t.amenity ?? '') || t.healthcare !== undefined, category: 'competitor', businessType: 'clinic' },
  { match: (t) => t.amenity === 'coworking_space' || t.office === 'coworking', category: 'competitor', businessType: 'coworking' },
  { match: (t) => ['car_repair', 'tyres', 'car_parts'].includes(t.shop ?? '') || t.amenity === 'car_wash', category: 'competitor', businessType: 'car-service' },
  { match: (t) => t.leisure === 'fitness_centre' || t.leisure === 'sports_centre', category: 'competitor', businessType: 'fitness' },
  { match: (t) => ['language_school', 'training', 'music_school', 'driving_school'].includes(t.amenity ?? ''), category: 'competitor', businessType: 'education' },
  { match: (t) => ['supermarket', 'convenience', 'clothes', 'shoes', 'electronics', 'mall', 'department_store'].includes(t.shop ?? ''), category: 'competitor', businessType: 'retail' },
  { match: (t) => t.public_transport === 'station' || t.railway === 'subway_entrance' || t.railway === 'station' || t.highway === 'bus_stop' || t.public_transport === 'platform', category: 'transport' },
  { match: (t) => ['school', 'kindergarten', 'university', 'college'].includes(t.amenity ?? ''), category: 'school' },
  { match: (t) => t.building === 'office' || t.office === 'company' || (t.building === 'commercial' && !!t.name), category: 'business_center' },
  { match: (t) => t.amenity === 'parking', category: 'parking' },
  { match: (t) => t.amenity === 'bank', category: 'bank' },
];

export function overpassQuery([s, w, n, e]: [number, number, number, number]) {
  const bbox = `${s},${w},${n},${e}`;
  return `[out:json][timeout:180];
(
  nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|bar|pub|nightclub|pharmacy|clinic|dentist|doctors|hospital|coworking_space|car_wash|language_school|training|music_school|driving_school|school|kindergarten|university|college|parking|bank)$"](${bbox});
  nwr["shop"~"^(bakery|pastry|confectionery|chemist|hairdresser|beauty|cosmetics|massage|car_repair|tyres|car_parts|supermarket|convenience|clothes|shoes|electronics|mall|department_store)$"](${bbox});
  nwr["leisure"~"^(fitness_centre|sports_centre)$"](${bbox});
  node["highway"="bus_stop"](${bbox});
  nwr["railway"~"^(subway_entrance|station)$"](${bbox});
  nwr["building"="office"](${bbox});
);
out center tags;`;
}

type OsmElement = { type: 'node' | 'way' | 'relation'; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

export function mapElement(el: OsmElement) {
  const tags = el.tags ?? {};
  const rule = TAG_RULES.find((r) => r.match(tags));
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!rule || lat === undefined || lng === undefined) return null;
  const name = tags['name:ka'] ?? tags.name ?? tags['name:en'] ?? (rule.category === 'transport' ? 'გაჩერება' : null);
  if (!name) return null;
  return { category: rule.category, businessType: rule.businessType ?? null, name: name.slice(0, 200), source: 'osm', sourceId: `${el.type}/${el.id}`, lat, lng };
}

async function fetchCity(city: string) {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'lokacia.ge POI importer (contact: dev@lokacia.ge)' },
    body: new URLSearchParams({ data: overpassQuery(CITY_BBOX[city]!) }),
  });
  if (!res.ok) throw new Error(`overpass ${city}: ${res.status}`);
  const json = (await res.json()) as { elements: OsmElement[] };
  return json.elements.map(mapElement).filter((x): x is NonNullable<ReturnType<typeof mapElement>> => !!x);
}

async function main() {
  const cities = process.argv.slice(2).filter((a) => CITY_BBOX[a]);
  const list = cities.length ? cities : Object.keys(CITY_BBOX);
  const dry = process.env.OSM_DRY_RUN === '1';
  const { db, client } = createDb(process.env.DATABASE_URL ?? 'postgres://lokacia:lokacia@localhost:5432/lokacia', { max: 2 });
  try {
    for (const city of list) {
      const rows = await fetchCity(city);
      const byCat = rows.reduce<Record<string, number>>((a, r) => ((a[r.category] = (a[r.category] ?? 0) + 1), a), {});
      console.log(`${city}: ${rows.length} POIs`, byCat);
      if (dry) continue;
      for (let i = 0; i < rows.length; i += 500) {
        await db
          .insert(pois)
          .values(rows.slice(i, i + 500))
          .onConflictDoUpdate({ target: [pois.source, pois.sourceId], set: { name: sql`excluded.name`, category: sql`excluded.category`, businessType: sql`excluded.business_type`, lat: sql`excluded.lat`, lng: sql`excluded.lng`, updatedAt: new Date(), deletedAt: null } });
      }
      // polite pause between cities
      await new Promise((r) => setTimeout(r, 5000));
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
