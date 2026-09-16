export type TrafficSample = { weekday: number; hour: number; count: number };
export interface TrafficProvider {
  readonly name: string;
  hourly(lat: number, lng: number): Promise<TrafficSample[]>;
}
export const TRAFFIC = Symbol('TRAFFIC');

const CURVE = [2, 1, 1, 1, 2, 4, 10, 25, 45, 50, 48, 55, 70, 65, 55, 52, 58, 72, 80, 70, 50, 32, 16, 6];

/** Deterministic pseudo foot-traffic: denser near Tbilisi center (Rustaveli/Liberty Sq). */
export class MockTraffic implements TrafficProvider {
  readonly name = 'mock';
  async hourly(lat: number, lng: number) {
    const d = Math.hypot(lat - 41.6934, (lng - 44.8015) * 0.75);
    const base = Math.max(0.25, 2.4 - d * 40);
    const seed = Math.abs(Math.sin(lat * 1000 + lng * 1000));
    const out: TrafficSample[] = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const wk = weekday === 0 || weekday === 6 ? 0.8 + seed * 0.4 : 1;
      for (let hour = 0; hour < 24; hour++) out.push({ weekday, hour, count: Math.round(CURVE[hour]! * base * wk * 10 * (0.9 + ((seed * (hour + 1)) % 0.2))) });
    }
    return out;
  }
}
