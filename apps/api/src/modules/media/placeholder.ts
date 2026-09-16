/**
 * Deterministic "architectural drawing" placeholders (BRAND.md: no stock photos, neutral placeholders in seeds).
 * Plaster background, basalt linework, one blueprint accent, a tiny sulfur detail.
 */
const C = { plaster: '#EDF0EB', paper: '#E3E8E1', basalt: '#17201D', stone: '#8A968F', blue: '#2F5FB8', green: '#1E4A42', sulfur: '#D8A31A' };

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const svg = (w: number, h: number, body: string, label?: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"${label ? ` aria-label="${label}"` : ''}><rect width="${w}" height="${h}" fill="${C.plaster}"/>${body}</svg>`;

function grid(w: number, h: number, step = 40) {
  let g = '';
  for (let x = step; x < w; x += step) g += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${C.stone}" stroke-opacity=".12" stroke-width="1"/>`;
  for (let y = step; y < h; y += step) g += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${C.stone}" stroke-opacity=".12" stroke-width="1"/>`;
  return g;
}

function interior(seed: string) {
  const r = hash(seed);
  const W = 1600;
  const H = 1067;
  const inset = 280 + r() * 120;
  const bx = inset;
  const by = 200 + r() * 80;
  const bw = W - inset * 2;
  const bh = H - by - 260 - r() * 60;
  const L = `stroke="${C.basalt}" stroke-width="3" stroke-linecap="square"`;
  let b = grid(W, H, 53);
  b += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${C.paper}" ${L.replace(' fill=\"none\"', '')}/>`;
  b += `<path d="M0 0 L${bx} ${by} M${W} 0 L${bx + bw} ${by} M0 ${H} L${bx} ${by + bh} M${W} ${H} L${bx + bw} ${by + bh}" ${L}/>`;
  const windows = 1 + Math.floor(r() * 3);
  const ww = (bw - 80 * (windows + 1)) / windows;
  for (let i = 0; i < windows; i++) {
    const x = bx + 80 + i * (ww + 80);
    const wy = by + 60;
    const wh = bh * (0.5 + r() * 0.25);
    b += `<rect x="${x}" y="${wy}" width="${ww}" height="${wh}" fill="${C.plaster}" stroke="${C.blue}" stroke-width="3"/>`;
    b += `<line x1="${x + ww / 2}" y1="${wy}" x2="${x + ww / 2}" y2="${wy + wh}" stroke="${C.blue}" stroke-width="2"/>`;
  }
  // floor boards in perspective
  for (let i = 1; i < 9; i++) {
    const t = i / 9;
    b += `<line x1="${bx + bw * t}" y1="${by + bh}" x2="${W * t}" y2="${H}" stroke="${C.stone}" stroke-opacity=".45" stroke-width="2"/>`;
  }
  // ceiling lamps
  const lamps = 2 + Math.floor(r() * 3);
  for (let i = 0; i < lamps; i++) {
    const x = bx + ((i + 1) * bw) / (lamps + 1);
    b += `<line x1="${x}" y1="${by * 0.3}" x2="${x}" y2="${by * 0.75}" stroke="${C.basalt}" stroke-width="2"/><circle cx="${x}" cy="${by * 0.8}" r="14" fill="${i === 0 ? C.sulfur : 'none'}" stroke="${C.basalt}" stroke-width="2"/>`;
  }
  // counter or desk
  if (r() > 0.4) {
    const cx = bx + bw * (0.1 + r() * 0.3);
    b += `<path d="M${cx} ${by + bh + 40} h${bw * 0.35} v90 h-${bw * 0.35} z" fill="${C.plaster}" ${L.replace(' fill=\"none\"', '')}/>`;
  }
  b += `<text x="40" y="${H - 40}" font-family="monospace" font-size="26" fill="${C.stone}">LK · ${seed.slice(0, 8).toUpperCase()}</text>`;
  return svg(W, H, b, 'ინტერიერი');
}

function facade(seed: string) {
  const r = hash(seed);
  const W = 1600;
  const H = 1067;
  const L = `stroke="${C.basalt}" stroke-width="3"`;
  let b = grid(W, H, 53);
  const floors = 3 + Math.floor(r() * 4);
  const fx = 220;
  const fw = W - 440;
  const fh = (H - 220) / (floors + 0.6);
  const top = H - 120 - fh * floors;
  b += `<rect x="${fx}" y="${top}" width="${fw}" height="${fh * floors}" fill="${C.paper}" ${L.replace(' fill=\"none\"', '')}/>`;
  const cols = 4 + Math.floor(r() * 3);
  for (let f = 1; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const x = fx + 50 + (c * (fw - 100)) / cols;
      const y = top + (f - 1) * fh + fh * 0.22;
      b += `<rect x="${x}" y="${y}" width="${(fw - 100) / cols - 50}" height="${fh * 0.55}" fill="${C.plaster}" stroke="${C.basalt}" stroke-width="2"/>`;
    }
  }
  // ground-floor shopfront
  const gy = top + (floors - 1) * fh;
  b += `<rect x="${fx + 40}" y="${gy + fh * 0.12}" width="${fw - 80}" height="${fh * 0.88}" fill="${C.plaster}" stroke="${C.blue}" stroke-width="4"/>`;
  for (let i = 1; i < 4; i++) b += `<line x1="${fx + 40 + ((fw - 80) * i) / 4}" y1="${gy + fh * 0.12}" x2="${fx + 40 + ((fw - 80) * i) / 4}" y2="${gy + fh}" stroke="${C.blue}" stroke-width="3"/>`;
  b += `<rect x="${fx + fw * 0.35}" y="${gy - fh * 0.05}" width="${fw * 0.3}" height="${fh * 0.14}" fill="${C.green}"/>`;
  b += `<rect x="${fx + fw * 0.35 + 18}" y="${gy + fh * 0.01}" width="18" height="18" fill="${C.sulfur}"/>`;
  b += `<line x1="0" y1="${H - 120}" x2="${W}" y2="${H - 120}" stroke="${C.basalt}" stroke-width="4"/>`;
  return svg(W, H, b, 'ფასადი');
}

function street(seed: string) {
  const r = hash(seed);
  const W = 1600;
  const H = 1067;
  let b = grid(W, H, 53);
  let x = 0;
  while (x < W) {
    const w = 180 + r() * 220;
    const h = 380 + r() * 420;
    b += `<rect x="${x}" y="${H - 160 - h}" width="${w}" height="${h}" fill="${r() > 0.8 ? C.paper : C.plaster}" stroke="${C.basalt}" stroke-width="3"/>`;
    for (let y = H - 160 - h + 40; y < H - 220; y += 70) b += `<line x1="${x + 20}" y1="${y}" x2="${x + w - 20}" y2="${y}" stroke="${C.stone}" stroke-width="2" stroke-dasharray="30 18"/>`;
    x += w;
  }
  b += `<rect x="0" y="${H - 160}" width="${W}" height="160" fill="${C.paper}" stroke="${C.basalt}" stroke-width="3"/>`;
  b += `<line x1="0" y1="${H - 80}" x2="${W}" y2="${H - 80}" stroke="${C.blue}" stroke-width="3" stroke-dasharray="60 40"/>`;
  b += `<circle cx="${W * (0.2 + r() * 0.6)}" cy="${H - 200}" r="12" fill="${C.sulfur}"/>`;
  return svg(W, H, b, 'ქუჩა');
}

function detail(seed: string) {
  const r = hash(seed);
  const W = 1600;
  const H = 1067;
  let b = grid(W, H, 40);
  const cx = W / 2;
  const cy = H / 2;
  const R = 260 + r() * 80;
  b += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${C.paper}" stroke="${C.basalt}" stroke-width="3"/>`;
  b += `<circle cx="${cx}" cy="${cy}" r="${R * 0.62}" fill="none" stroke="${C.blue}" stroke-width="3" stroke-dasharray="12 10"/>`;
  b += `<line x1="${cx - R - 80}" y1="${cy}" x2="${cx + R + 80}" y2="${cy}" stroke="${C.basalt}" stroke-width="2"/><line x1="${cx}" y1="${cy - R - 80}" x2="${cx}" y2="${cy + R + 80}" stroke="${C.basalt}" stroke-width="2"/>`;
  b += `<circle cx="${cx + R * 0.62}" cy="${cy}" r="14" fill="${C.sulfur}"/>`;
  return svg(W, H, b, 'დეტალი');
}

function plan(seed: string) {
  const r = hash(seed);
  const W = 1600;
  const H = 1067;
  let b = grid(W, H, 40);
  const x = 260;
  const y = 180;
  const w = 900 + r() * 200;
  const h = 560 + r() * 120;
  const notch = r() > 0.5;
  const path = notch ? `M${x} ${y} h${w} v${h * 0.6} h-${w * 0.35} v${h * 0.4} h-${w * 0.65} z` : `M${x} ${y} h${w} v${h} h-${w} z`;
  b += `<path d="${path}" fill="${C.paper}" stroke="${C.basalt}" stroke-width="10" stroke-linejoin="miter"/>`;
  b += `<line x1="${x + w * 0.45}" y1="${y}" x2="${x + w * 0.45}" y2="${y + h * 0.45}" stroke="${C.basalt}" stroke-width="5"/>`;
  b += `<path d="M${x + w * 0.45} ${y + h * 0.45} a90 90 0 0 1 90 90" fill="none" stroke="${C.stone}" stroke-width="2"/>`;
  b += `<line x1="${x}" y1="${y - 60}" x2="${x + w}" y2="${y - 60}" stroke="${C.blue}" stroke-width="2"/><line x1="${x}" y1="${y - 75}" x2="${x}" y2="${y - 45}" stroke="${C.blue}" stroke-width="2"/><line x1="${x + w}" y1="${y - 75}" x2="${x + w}" y2="${y - 45}" stroke="${C.blue}" stroke-width="2"/>`;
  b += `<line x1="${x - 60}" y1="${y}" x2="${x - 60}" y2="${y + h}" stroke="${C.blue}" stroke-width="2"/>`;
  b += `<rect x="${x + 30}" y="${y + h - 60}" width="120" height="16" fill="${C.sulfur}"/>`;
  return svg(W, H, b, 'ნახაზი');
}

function pano(seed: string) {
  const r = hash(seed);
  const W = 2400;
  const H = 900;
  let b = grid(W, H, 60);
  for (let i = 0; i < 4; i++) {
    const x0 = (i * W) / 4;
    b += `<path d="M${x0} 120 Q${x0 + W / 8} ${60 + r() * 40} ${x0 + W / 4} 120 L${x0 + W / 4} ${H - 120} Q${x0 + W / 8} ${H - 60} ${x0} ${H - 120} Z" fill="${i % 2 ? C.paper : C.plaster}" stroke="${C.basalt}" stroke-width="3"/>`;
    b += `<rect x="${x0 + 120}" y="260" width="${W / 4 - 240}" height="300" fill="${C.plaster}" stroke="${C.blue}" stroke-width="3"/>`;
  }
  b += `<text x="40" y="${H - 40}" font-family="monospace" font-size="30" fill="${C.stone}">360°</text>`;
  return svg(W, H, b, '360° ფოტო');
}

function document(seed: string) {
  const W = 1200;
  const H = 1600;
  let b = `<rect x="120" y="100" width="960" height="1400" fill="#fff" stroke="${C.basalt}" stroke-width="3"/>`;
  b += `<rect x="180" y="170" width="300" height="40" fill="${C.green}"/>`;
  for (let i = 0; i < 22; i++) b += `<rect x="180" y="${280 + i * 48}" width="${840 - ((i * 37 + seed.length * 13) % 300)}" height="14" fill="${C.stone}" opacity=".45"/>`;
  b += `<circle cx="900" cy="1360" r="80" fill="none" stroke="${C.blue}" stroke-width="6"/>`;
  return svg(W, H, b, 'ამონაწერი');
}

const RENDERERS: Record<string, (seed: string) => string> = { interior, facade, street, detail, plan, pano, document };

export function placeholderSvg(kind: string, seed: string): string {
  return (RENDERERS[kind] ?? interior)(seed);
}
