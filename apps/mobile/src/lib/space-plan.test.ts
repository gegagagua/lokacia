import { describe, expect, it } from 'vitest';
import { planDimensions, spacePlanGeometry } from './space-plan';

describe('SpacePlan geometry', () => {
  it('uses passport width/depth when present', () => {
    expect(planDimensions({ widthM: 6, depthM: 12, areaM2: 72 })).toEqual({ widthM: 6, depthM: 12 });
  });

  it('derives missing dimensions from the area with a 1.4 aspect', () => {
    const d = planDimensions({ areaM2: 140 });
    expect(d.widthM).toBeCloseTo(14, 5);
    expect(d.widthM * d.depthM).toBeCloseTo(140, 5);
    const onlyWidth = planDimensions({ widthM: 5, areaM2: 100 });
    expect(onlyWidth.depthM).toBe(20);
  });

  it('keeps the plan inside the padded viewBox and preserves the aspect ratio', () => {
    for (const [w, d] of [
      [4, 40],
      [40, 4],
      [10, 10],
    ] as const) {
      const g = spacePlanGeometry({ widthM: w, depthM: d, areaM2: w * d });
      expect(g.rect.x).toBeGreaterThanOrEqual(44 - 1e-9);
      expect(g.rect.y).toBeGreaterThanOrEqual(34 - 1e-9);
      expect(g.rect.x + g.rect.w).toBeLessThanOrEqual(320 - 28 + 1e-9);
      expect(g.rect.y + g.rect.h).toBeLessThanOrEqual(220 - 44 + 1e-9);
      expect(g.rect.w / g.rect.h).toBeCloseTo(w / d, 6);
    }
  });

  it('draws a closed rectangle path by default and scales a custom outline', () => {
    const rect = spacePlanGeometry({ widthM: 10, depthM: 5, areaM2: 50 });
    expect(rect.path.startsWith('M')).toBe(true);
    expect(rect.path.endsWith('Z')).toBe(true);
    expect(rect.path.match(/L/g)).toHaveLength(3);
    const l = spacePlanGeometry({ widthM: 10, depthM: 10, areaM2: 75, outline: [[0, 0], [10, 0], [10, 5], [5, 5], [5, 10], [0, 10]] });
    expect(l.path.match(/L/g)).toHaveLength(5);
    expect(l.path).toContain(`${(l.rect.x + l.rect.w).toFixed(1)} ${l.rect.y.toFixed(1)}`);
  });

  it('places dimension lines outside the plan and compacts height for cards', () => {
    const g = spacePlanGeometry({ widthM: 8, depthM: 12, areaM2: 96, compact: true });
    expect(g.viewBox).toEqual({ w: 320, h: 180 });
    expect(g.widthDim.y).toBeLessThan(g.rect.y);
    expect(g.depthDim.x).toBeLessThan(g.rect.x);
    expect(g.door.r).toBeLessThanOrEqual(28);
    expect(g.grid.vertical).toHaveLength(20);
  });
});
