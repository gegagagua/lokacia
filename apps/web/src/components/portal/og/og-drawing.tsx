import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { formatNumber } from '@lokacia/contracts';

export const OG_SIZE = { width: 1200, height: 630 };
export const C = { plaster: '#EDF0EB', basalt: '#17201D', green: '#1E4A42', sulfur: '#D8A31A', blueprint: '#2F5FB8', stone: '#8A968F', surface: '#F7F9F5' };

let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: 'normal' }[]> | null = null;

/** Noto Sans Georgian TTFs (satori needs TTF/OTF). Read once per server process. */
export function ogFonts() {
  fontsPromise ??= (async () => {
    const candidates = [path.join(process.cwd(), 'src/components/portal/og/fonts'), path.join(process.cwd(), 'apps/web/src/components/portal/og/fonts')];
    for (const dir of candidates) {
      try {
        const [regular, bold] = await Promise.all([fs.readFile(path.join(dir, 'NotoSansGeorgian_400Regular.ttf')), fs.readFile(path.join(dir, 'NotoSansGeorgian_700Bold.ttf'))]);
        return [
          { name: 'Noto Sans Georgian', data: regular, weight: 400 as const, style: 'normal' as const },
          { name: 'Noto Sans Georgian', data: bold, weight: 700 as const, style: 'normal' as const },
        ];
      } catch {
        /* try next */
      }
    }
    fontsPromise = null;
    return [];
  })();
  return fontsPromise;
}

/** Brand mark: two plan lines + sulfur dot, and the wordmark. */
export function OgLogo({ inverse = false }: { inverse?: boolean }) {
  const stroke = inverse ? C.plaster : C.green;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <svg width="44" height="44" viewBox="0 0 32 32">
        <path d="M5 27V9" stroke={stroke} strokeWidth="2.6" strokeLinecap="square" />
        <path d="M5 27H23" stroke={stroke} strokeWidth="2.6" strokeLinecap="square" />
        <circle cx="21" cy="11" r="4.2" fill={C.sulfur} />
      </svg>
      <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: inverse ? C.plaster : C.basalt, letterSpacing: -0.5 }}>lokacia.ge</div>
    </div>
  );
}

/**
 * SpacePlan-style drawing for satori: outline rectangle, width/depth dimension lines (blueprint blue),
 * one sulfur accent dot, labels as absolutely positioned divs (satori can't render SVG text).
 */
export function OgPlan({ widthM, depthM, areaM2, box = { w: 440, h: 400 } }: { widthM?: number | null; depthM?: number | null; areaM2: number; box?: { w: number; h: number } }) {
  const w = widthM && widthM > 0 ? widthM : Math.sqrt(areaM2 * 1.4);
  const d = depthM && depthM > 0 ? depthM : areaM2 / w;
  const pad = { l: 64, r: 24, t: 60, b: 24 };
  const scale = Math.min((box.w - pad.l - pad.r) / w, (box.h - pad.t - pad.b) / d);
  const pw = w * scale;
  const pd = d * scale;
  const ox = pad.l + (box.w - pad.l - pad.r - pw) / 2;
  const oy = pad.t + (box.h - pad.t - pad.b - pd) / 2;
  const door = Math.min(40, pw * 0.25);
  const grid: React.ReactNode[] = [];
  for (let x = 0; x <= box.w; x += 20) grid.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={box.h} stroke="#CDD4CC" strokeWidth="1" />);
  for (let y = 0; y <= box.h; y += 20) grid.push(<line key={`h${y}`} x1={0} y1={y} x2={box.w} y2={y} stroke="#CDD4CC" strokeWidth="1" />);
  return (
    <div style={{ display: 'flex', position: 'relative', width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        <g opacity="0.6">{grid}</g>
        <rect x={ox} y={oy} width={pw} height={pd} fill={C.surface} stroke={C.basalt} strokeWidth="5" />
        {/* entrance gap + door swing */}
        <line x1={ox + pw * 0.2} y1={oy + pd} x2={ox + pw * 0.2 + door} y2={oy + pd} stroke={C.surface} strokeWidth="7" />
        <path d={`M${ox + pw * 0.2} ${oy + pd} a${door} ${door} 0 0 0 ${door} ${-door}`} fill="none" stroke={C.stone} strokeWidth="1.5" />
        {/* width dimension */}
        <line x1={ox} y1={oy - 22} x2={ox + pw} y2={oy - 22} stroke={C.blueprint} strokeWidth="2" />
        <line x1={ox} y1={oy - 30} x2={ox} y2={oy - 14} stroke={C.blueprint} strokeWidth="2" />
        <line x1={ox + pw} y1={oy - 30} x2={ox + pw} y2={oy - 14} stroke={C.blueprint} strokeWidth="2" />
        {/* depth dimension */}
        <line x1={ox - 22} y1={oy} x2={ox - 22} y2={oy + pd} stroke={C.blueprint} strokeWidth="2" />
        <line x1={ox - 30} y1={oy} x2={ox - 14} y2={oy} stroke={C.blueprint} strokeWidth="2" />
        <line x1={ox - 30} y1={oy + pd} x2={ox - 14} y2={oy + pd} stroke={C.blueprint} strokeWidth="2" />
        <circle cx={ox + pw - 18} cy={oy + 18} r="8" fill={C.sulfur} />
      </svg>
      <div style={{ position: 'absolute', left: ox, top: oy - 58, width: pw, display: 'flex', justifyContent: 'center', fontSize: 22, color: C.blueprint }}>{`${formatNumber(w, 1)} მ`}</div>
      <div style={{ position: 'absolute', left: 0, top: oy + pd / 2 - 16, width: ox - 28, display: 'flex', justifyContent: 'flex-end', fontSize: 22, color: C.blueprint }}>{`${formatNumber(d, 1)} მ`}</div>
      <div style={{ position: 'absolute', left: ox, top: oy + pd / 2 - 30, width: pw, display: 'flex', justifyContent: 'center', fontSize: Math.max(28, Math.min(52, pw / 4)), fontWeight: 700, color: C.basalt }}>{`${formatNumber(areaM2)} მ²`}</div>
    </div>
  );
}
