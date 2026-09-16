/** Day route ordering for viewings (C4): nearest-neighbour from a start point, then 2-opt improvement. */
export type GeoPoint = { lat: number; lng: number };

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Open path length: start → p[0] → p[1] → … (no return). */
export function pathKm(start: GeoPoint, pts: GeoPoint[]): number {
  let total = 0;
  let prev = start;
  for (const p of pts) {
    total += haversineKm(prev, p);
    prev = p;
  }
  return total;
}

export function nearestNeighbour<T extends GeoPoint>(start: GeoPoint, pts: T[]): T[] {
  const left = [...pts];
  const out: T[] = [];
  let cur: GeoPoint = start;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (haversineKm(cur, left[i]!) < haversineKm(cur, left[best]!)) best = i;
    const [next] = left.splice(best, 1);
    out.push(next!);
    cur = next!;
  }
  return out;
}

/** 2-opt on an open path with a fixed start: reverse segments while it shortens the path. */
export function twoOpt<T extends GeoPoint>(start: GeoPoint, route: T[]): T[] {
  let best = [...route];
  let bestKm = pathKm(start, best);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const cand = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const km = pathKm(start, cand);
        if (km + 1e-9 < bestKm) {
          best = cand;
          bestKm = km;
          improved = true;
        }
      }
    }
  }
  return best;
}

export function optimizeRoute<T extends GeoPoint>(start: GeoPoint, pts: T[]): { order: T[]; km: number } {
  const order = twoOpt(start, nearestNeighbour(start, pts));
  return { order, km: pathKm(start, order) };
}

export const TBILISI_CENTER: GeoPoint = { lat: 41.7151, lng: 44.8271 };
