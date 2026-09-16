/**
 * Geometry for the SpacePlan signature component (BRAND.md) — same maths as packages/ui SpacePlan (web),
 * kept framework-free so it is unit-tested and drawn with react-native-svg.
 */
export type SpacePlanInput = {
  widthM?: number | null;
  depthM?: number | null;
  areaM2: number;
  outline?: readonly (readonly [number, number])[] | null;
  compact?: boolean;
};

export type SpacePlanGeometry = {
  viewBox: { w: number; h: number };
  widthM: number;
  depthM: number;
  /** plan rectangle in view units */
  rect: { x: number; y: number; w: number; h: number };
  path: string;
  widthDim: { y: number; x1: number; x2: number; labelX: number; labelY: number };
  depthDim: { x: number; y1: number; y2: number; labelX: number; labelY: number };
  door: { x: number; y: number; r: number };
  pin: { cx: number; cy: number };
  grid: { vertical: number[]; horizontal: number[] };
  footerY: number;
};

const GRID = 16;

/** Missing width/depth are derived from the area with a 1.4 aspect (shop floors are deeper than wide). */
export function planDimensions(input: Pick<SpacePlanInput, 'widthM' | 'depthM' | 'areaM2'>): { widthM: number; depthM: number } {
  const area = input.areaM2 > 0 ? input.areaM2 : 1;
  const w = input.widthM && input.widthM > 0 ? input.widthM : Math.sqrt(area * 1.4);
  const d = input.depthM && input.depthM > 0 ? input.depthM : area / w;
  return { widthM: w, depthM: d };
}

export function spacePlanGeometry(input: SpacePlanInput): SpacePlanGeometry {
  const { widthM: w, depthM: d } = planDimensions(input);
  const VW = 320;
  const VH = input.compact ? 180 : 220;
  const pad = { l: 44, r: 28, t: 34, b: input.compact ? 26 : 44 };
  const scale = Math.min((VW - pad.l - pad.r) / w, (VH - pad.t - pad.b) / d);
  const pw = w * scale;
  const pd = d * scale;
  const ox = pad.l + (VW - pad.l - pad.r - pw) / 2;
  const oy = pad.t + (VH - pad.t - pad.b - pd) / 2;
  const outline = input.outline && input.outline.length >= 3 ? input.outline : null;
  const pts: [number, number][] = outline
    ? outline.map(([x, y]) => [ox + (x / w) * pw, oy + (y / d) * pd])
    : [
        [ox, oy],
        [ox + pw, oy],
        [ox + pw, oy + pd],
        [ox, oy + pd],
      ];
  const path = `${pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')} Z`;
  const r = Math.min(28, pw * 0.25);
  return {
    viewBox: { w: VW, h: VH },
    widthM: w,
    depthM: d,
    rect: { x: ox, y: oy, w: pw, h: pd },
    path,
    widthDim: { y: oy - 14, x1: ox, x2: ox + pw, labelX: ox + pw / 2, labelY: oy - 20 },
    depthDim: { x: ox - 14, y1: oy, y2: oy + pd, labelX: ox - 20, labelY: oy + pd / 2 },
    door: { x: ox + pw * 0.2, y: oy + pd, r },
    pin: { cx: ox + pw - 10, cy: oy + 10 },
    grid: {
      vertical: Array.from({ length: Math.floor(VW / GRID) }, (_, i) => i * GRID),
      horizontal: Array.from({ length: Math.floor(VH / GRID) }, (_, i) => i * GRID),
    },
    footerY: VH - 14,
  };
}
