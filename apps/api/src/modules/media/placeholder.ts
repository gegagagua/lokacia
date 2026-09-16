import sharp from 'sharp';

/**
 * Deterministic illustrated placeholders for seeded listings (no stock photos — docs/DECISIONS.md).
 * v2: colourful flat-3D illustrations with daylight, materials and depth, so demo listings feel like real spaces.
 */

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const pick = <T>(r: () => number, arr: readonly T[]) => arr[Math.floor(r() * arr.length)] as T;
const f = (n: number) => Math.round(n * 10) / 10;

const PALETTES = [
  { wall: '#EFE9E1', wall2: '#E4DCD1', floor1: '#C89B6D', floor2: '#A97B50', accent: '#1E4A42', accent2: '#D8A31A', sky1: '#9CC9F0', sky2: '#E9F4FB', metal: '#2B3431' },
  { wall: '#E8EEEA', wall2: '#D9E3DD', floor1: '#B9B2A8', floor2: '#9C958B', accent: '#2F5FB8', accent2: '#E2AA1C', sky1: '#8EC0EA', sky2: '#EAF4FA', metal: '#1F2A27' },
  { wall: '#F3EEE6', wall2: '#E6DED2', floor1: '#D8C3A5', floor2: '#BFA682', accent: '#B4492F', accent2: '#1E4A42', sky1: '#F4C38E', sky2: '#FCEBD8', metal: '#3A3330' },
  { wall: '#EDEFF2', wall2: '#DDE2E8', floor1: '#8D9AA5', floor2: '#6E7B86', accent: '#1E4A42', accent2: '#F0BD3A', sky1: '#A8D2F2', sky2: '#EEF6FC', metal: '#232A30' },
] as const;

const svg = (w: number, h: number, defs: string, body: string, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}"><defs>${defs}</defs>${body}</svg>`;

function plant(x: number, y: number, s: number, green = '#3E8E5E') {
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><ellipse cx="0" cy="-70" rx="46" ry="60" fill="${green}"/><ellipse cx="-34" cy="-40" rx="30" ry="40" fill="#2F7A4E"/><ellipse cx="32" cy="-44" rx="30" ry="38" fill="#4FA16D"/><path d="M-30 0 h60 l-8 56 h-44 z" fill="#E7DCCD"/><path d="M-30 0 h60 v8 h-60z" fill="#D6C8B5"/></g>`;
}

function pendant(x: number, top: number, len: number, color: string) {
  return `<g><line x1="${f(x)}" y1="${f(top)}" x2="${f(x)}" y2="${f(top + len)}" stroke="#2B3431" stroke-width="3"/><path d="M${f(x - 34)} ${f(top + len + 30)} Q${f(x)} ${f(top + len - 16)} ${f(x + 34)} ${f(top + len + 30)} z" fill="${color}"/><ellipse cx="${f(x)}" cy="${f(top + len + 34)}" rx="16" ry="6" fill="#FFE9A8"/><ellipse cx="${f(x)}" cy="${f(top + len + 120)}" rx="120" ry="90" fill="url(#glow)" opacity=".55"/></g>`;
}

/** Interior: cafe / office / retail / loft scene chosen by seed. */
function interior(seed: string) {
  const r = hash(seed);
  const P = pick(r, PALETTES);
  const W = 1600;
  const H = 1067;
  const scene = pick(r, ['cafe', 'office', 'retail', 'loft'] as const);
  const horizon = 690 + r() * 40;
  const defs = `<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.wall}"/><stop offset="1" stop-color="${P.wall2}"/></linearGradient><linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.floor1}"/><stop offset="1" stop-color="${P.floor2}"/></linearGradient><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky1}"/><stop offset="1" stop-color="${P.sky2}"/></linearGradient><linearGradient id="beam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF6D8" stop-opacity=".75"/><stop offset="1" stop-color="#FFF6D8" stop-opacity="0"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="#FFE7A0" stop-opacity=".9"/><stop offset="1" stop-color="#FFE7A0" stop-opacity="0"/></radialGradient><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>`;
  let b = `<rect width="${W}" height="${H}" fill="url(#wall)"/><rect width="${W}" height="70" fill="${P.wall2}"/><rect y="70" width="${W}" height="6" fill="#000" opacity=".05"/>`;
  const winCount = 2 + Math.floor(r() * 2);
  const winW = (W - 240) / winCount - 60;
  for (let i = 0; i < winCount; i++) {
    const x = 150 + i * (winW + 60);
    const y = 150;
    const h = horizon - 250;
    b += `<rect x="${f(x - 10)}" y="${y - 10}" width="${f(winW + 20)}" height="${f(h + 20)}" rx="6" fill="${P.metal}"/><rect x="${f(x)}" y="${y}" width="${f(winW)}" height="${f(h)}" fill="url(#sky)"/>`;
    let sx = x;
    while (sx < x + winW) {
      const bw = 40 + r() * 70;
      const bh = 60 + r() * 180;
      b += `<rect x="${f(sx)}" y="${f(y + h - bh)}" width="${f(Math.min(bw, x + winW - sx))}" height="${f(bh)}" fill="#B9C6CF" opacity="${f(0.55 + r() * 0.3)}"/>`;
      sx += bw + 6;
    }
    b += `<rect x="${f(x + winW / 2 - 4)}" y="${y}" width="8" height="${f(h)}" fill="${P.metal}"/><polygon points="${f(x)},${y} ${f(x + winW)},${y} ${f(x + winW + 260)},${H} ${f(x + 120)},${H}" fill="url(#beam)" opacity=".35"/>`;
  }
  b += `<rect y="${f(horizon)}" width="${W}" height="${f(H - horizon)}" fill="url(#floor)"/>`;
  for (let i = 0; i < 14; i++) b += `<line x1="${f(i * 120 - 200)}" y1="${f(horizon)}" x2="${f(i * 160 - 500)}" y2="${H}" stroke="#000" stroke-opacity=".06" stroke-width="3"/>`;
  b += `<rect y="${f(horizon - 14)}" width="${W}" height="14" fill="${P.wall2}"/>`;

  if (scene === 'cafe') {
    const cx = 880 + r() * 120;
    b += `<rect x="${f(cx)}" y="${f(horizon - 190)}" width="620" height="230" rx="10" fill="${P.accent}"/><rect x="${f(cx - 12)}" y="${f(horizon - 206)}" width="644" height="26" rx="8" fill="#F4EFE7"/>`;
    for (let i = 0; i < 6; i++) b += `<rect x="${f(cx + 20 + i * 100)}" y="${f(horizon - 150)}" width="70" height="150" rx="6" fill="#000" opacity=".08"/>`;
    b += `<rect x="${f(cx + 60)}" y="${f(horizon - 290)}" width="120" height="84" rx="10" fill="#C7CCD0"/><rect x="${f(cx + 76)}" y="${f(horizon - 272)}" width="88" height="30" rx="6" fill="#2B3431"/>`;
    for (let i = 0; i < 3; i++) {
      const sx = cx + 70 + i * 190;
      b += `<rect x="${f(sx)}" y="${f(horizon + 40)}" width="10" height="180" fill="${P.metal}"/><ellipse cx="${f(sx + 5)}" cy="${f(horizon + 40)}" rx="54" ry="16" fill="${P.accent2}"/>`;
    }
    for (let i = 0; i < 3; i++) b += pendant(cx + 120 + i * 200, 76, 170 + r() * 40, P.accent2);
    b += `<ellipse cx="420" cy="${f(horizon + 170)}" rx="170" ry="34" fill="#F4EFE7"/><rect x="410" y="${f(horizon + 170)}" width="20" height="160" fill="${P.metal}"/><rect x="210" y="${f(horizon + 110)}" width="90" height="120" rx="14" fill="${P.accent}"/><rect x="540" y="${f(horizon + 110)}" width="90" height="120" rx="14" fill="${P.accent}"/>`;
    b += plant(120, horizon + 60, 1.1);
  } else if (scene === 'office') {
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 3; i++) {
        const x = 220 + i * 430 + row * 60;
        const y = horizon + 60 + row * 150;
        b += `<rect x="${f(x)}" y="${f(y)}" width="330" height="22" rx="6" fill="#F7F4EE"/><rect x="${f(x + 20)}" y="${f(y + 22)}" width="10" height="110" fill="${P.metal}"/><rect x="${f(x + 300)}" y="${f(y + 22)}" width="10" height="110" fill="${P.metal}"/><rect x="${f(x + 110)}" y="${f(y - 96)}" width="130" height="86" rx="8" fill="#2B3431"/><rect x="${f(x + 118)}" y="${f(y - 88)}" width="114" height="66" rx="4" fill="${P.sky1}"/><rect x="${f(x + 168)}" y="${f(y - 10)}" width="14" height="10" fill="#2B3431"/><rect x="${f(x + 130)}" y="${f(y + 40)}" width="90" height="90" rx="20" fill="${P.accent}"/>`;
      }
    }
    b += plant(1480, horizon + 40, 1.2) + plant(90, horizon + 80, 0.9);
    for (let i = 0; i < 4; i++) b += `<rect x="${f(160 + i * 360)}" y="76" width="220" height="16" rx="8" fill="#FFF8E1" opacity=".95"/>`;
  } else if (scene === 'retail') {
    for (let i = 0; i < 3; i++) {
      const x = 180 + i * 470;
      b += `<rect x="${f(x)}" y="${f(horizon - 330)}" width="360" height="360" rx="10" fill="#F7F4EE" stroke="${P.metal}" stroke-opacity=".15" stroke-width="4"/>`;
      for (let sh = 0; sh < 3; sh++) {
        const y = horizon - 300 + sh * 110;
        b += `<rect x="${f(x + 16)}" y="${f(y + 70)}" width="328" height="10" fill="${P.metal}" opacity=".25"/>`;
        for (let k = 0; k < 5; k++) {
          const hh = 30 + r() * 30;
          b += `<rect x="${f(x + 26 + k * 64)}" y="${f(y + 70 - hh)}" width="44" height="${f(hh)}" rx="6" fill="${pick(r, [P.accent, P.accent2, '#E8DCCB', '#B7C9C1', '#C9D5E8'])}"/>`;
        }
      }
    }
    b += `<rect x="560" y="${f(horizon + 70)}" width="480" height="130" rx="18" fill="${P.accent}"/><rect x="540" y="${f(horizon + 50)}" width="520" height="30" rx="12" fill="#F4EFE7"/>`;
    for (let i = 0; i < 3; i++) b += pendant(420 + i * 380, 76, 120, '#F4EFE7');
  } else {
    for (let y = 90; y < horizon - 20; y += 34) for (let x = Math.round(y / 34) % 2 ? -40 : 0; x < 560; x += 80) b += `<rect x="${f(x)}" y="${f(y)}" width="74" height="28" rx="3" fill="#B86B4B" opacity="${f(0.55 + r() * 0.35)}"/>`;
    b += `<rect x="620" y="${f(horizon + 50)}" width="560" height="150" rx="40" fill="${P.accent}"/><rect x="600" y="${f(horizon - 30)}" width="600" height="110" rx="46" fill="${P.accent}" opacity=".85"/><rect x="780" y="${f(horizon + 150)}" width="240" height="70" rx="14" fill="#F4EFE7"/><rect x="1240" y="${f(horizon - 380)}" width="260" height="380" rx="8" fill="#6B4E37"/>`;
    for (let i = 0; i < 4; i++) b += `<rect x="1256" y="${f(horizon - 360 + i * 92)}" width="228" height="8" fill="#523B29"/><rect x="${f(1270 + r() * 150)}" y="${f(horizon - 400 + i * 92 + 40)}" width="44" height="40" rx="6" fill="${pick(r, [P.accent2, '#E8DCCB', '#9FB8AE'])}"/>`;
    b += plant(560, horizon + 40, 1.3) + pendant(900, 76, 200, P.accent2);
  }
  b += `<rect width="${W}" height="${H}" fill="url(#shade)"/>`;
  return svg(W, H, defs, b, 'ინტერიერი');
}

function facade(seed: string) {
  const r = hash(seed);
  const P = pick(r, PALETTES);
  const W = 1600;
  const H = 1067;
  const ground = 900;
  const wallColor = pick(r, ['#EDE3D4', '#E3E7EA', '#E9DCCB', '#D9E1DC', '#F1E9DF']);
  const defs = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky1}"/><stop offset="1" stop-color="${P.sky2}"/></linearGradient><linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#CFE4F2"/><stop offset=".5" stop-color="#8FB3CC"/><stop offset="1" stop-color="#B9D4E6"/></linearGradient><linearGradient id="interiorGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE6A8" stop-opacity="0"/><stop offset="1" stop-color="#FFD98A" stop-opacity=".55"/></linearGradient><linearGradient id="walk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CFCAC2"/><stop offset="1" stop-color="#B3ADA4"/></linearGradient>`;
  let b = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  for (let i = 0; i < 3; i++) b += `<ellipse cx="${f(200 + r() * 1200)}" cy="${f(80 + r() * 120)}" rx="${f(90 + r() * 80)}" ry="${f(26 + r() * 16)}" fill="#fff" opacity=".7"/>`;
  const bx = 160;
  const bw = W - 320;
  const floors = 3 + Math.floor(r() * 3);
  const fh = 150;
  const top = ground - fh * floors - 190;
  b += `<rect x="${bx}" y="${f(top)}" width="${bw}" height="${f(ground - top)}" fill="${wallColor}"/><rect x="${bx - 20}" y="${f(top - 24)}" width="${bw + 40}" height="30" fill="#C9BBA6"/>`;
  const cols = 5;
  for (let fl = 0; fl < floors; fl++) {
    for (let c = 0; c < cols; c++) {
      const x = bx + 60 + (c * (bw - 120)) / cols;
      const y = top + 30 + fl * fh;
      const ww = (bw - 120) / cols - 70;
      b += `<rect x="${f(x)}" y="${f(y)}" width="${f(ww)}" height="96" rx="4" fill="url(#glass)"/><rect x="${f(x - 6)}" y="${f(y + 96)}" width="${f(ww + 12)}" height="10" fill="#fff" opacity=".8"/>`;
      if (r() > 0.65) b += `<rect x="${f(x + 8)}" y="${f(y + 20)}" width="${f(ww - 16)}" height="60" fill="#F3E5C7" opacity=".6"/>`;
      if (r() > 0.75) b += `<rect x="${f(x - 10)}" y="${f(y + 70)}" width="${f(ww + 20)}" height="36" fill="none" stroke="${P.metal}" stroke-width="4"/>`;
    }
  }
  const gy = ground - 190;
  b += `<rect x="${bx}" y="${f(gy)}" width="${bw}" height="190" fill="${P.metal}"/><rect x="${bx + 40}" y="${f(gy + 34)}" width="${bw - 80}" height="156" fill="url(#glass)"/><rect x="${bx + 40}" y="${f(gy + 34)}" width="${bw - 80}" height="156" fill="url(#interiorGlow)"/>`;
  for (let i = 1; i < 5; i++) b += `<rect x="${f(bx + 40 + ((bw - 80) * i) / 5 - 3)}" y="${f(gy + 34)}" width="6" height="156" fill="${P.metal}"/>`;
  b += `<path d="M${bx + 20} ${f(gy + 34)} h${bw - 40} l-30 60 h${-(bw - 100)} z" fill="${P.accent}"/>`;
  for (let i = 0; i < 16; i++) b += `<path d="M${f(bx + 50 + i * ((bw - 100) / 16))} ${f(gy + 94)} q${f((bw - 100) / 32)} 22 ${f((bw - 100) / 16)} 0" fill="${P.accent}"/>`;
  b += `<rect x="${f(W / 2 - 180)}" y="${f(gy - 8)}" width="360" height="40" rx="8" fill="#F7F4EE"/><circle cx="${f(W / 2 - 150)}" cy="${f(gy + 12)}" r="9" fill="${P.accent2}"/><rect x="${f(W / 2 - 126)}" y="${f(gy + 6)}" width="220" height="12" rx="6" fill="${P.accent}"/>`;
  b += `<rect y="${ground}" width="${W}" height="${H - ground}" fill="url(#walk)"/><rect y="${ground}" width="${W}" height="10" fill="#9E978D"/>`;
  for (const tx of [90, 1510]) b += `<rect x="${tx - 8}" y="${ground - 200}" width="16" height="210" fill="#6B4E37"/><circle cx="${tx}" cy="${ground - 240}" r="90" fill="#4F9A63"/><circle cx="${tx - 50}" cy="${ground - 200}" r="60" fill="#3E8455"/><circle cx="${tx + 50}" cy="${ground - 210}" r="60" fill="#5DAA70"/>`;
  for (let i = 0; i < 3; i++) {
    const px = 360 + r() * 900;
    const col = pick(r, [P.accent, P.accent2, '#2F5FB8', '#B4492F']);
    b += `<circle cx="${f(px)}" cy="${ground - 110}" r="16" fill="#C98E6B"/><rect x="${f(px - 20)}" y="${ground - 92}" width="40" height="70" rx="16" fill="${col}"/><rect x="${f(px - 16)}" y="${ground - 26}" width="12" height="36" fill="#2B3431"/><rect x="${f(px + 4)}" y="${ground - 26}" width="12" height="36" fill="#2B3431"/>`;
  }
  return svg(W, H, defs, b, 'ფასადი');
}

function street(seed: string) {
  const r = hash(seed);
  const W = 1600;
  const H = 1067;
  const dusk = r() > 0.5;
  const defs = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dusk ? '#F3A46B' : '#86BDEB'}"/><stop offset=".6" stop-color="${dusk ? '#F7D29B' : '#CFE6F7'}"/><stop offset="1" stop-color="${dusk ? '#FBE7C4' : '#EEF6FB'}"/></linearGradient><linearGradient id="road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E6664"/><stop offset="1" stop-color="#3E4543"/></linearGradient>`;
  let b = `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="${f(300 + r() * 1000)}" cy="${dusk ? 520 : 160}" r="${dusk ? 90 : 60}" fill="${dusk ? '#FFD37A' : '#FFF6D6'}" opacity=".9"/>`;
  b += `<path d="M0 560 Q200 430 420 520 T860 470 T1300 520 T1600 480 V760 H0z" fill="${dusk ? '#C9876B' : '#9FB9A6'}" opacity=".55"/><path d="M0 640 Q260 540 520 610 T1040 580 T1600 620 V760 H0z" fill="${dusk ? '#A86A58' : '#7FA08A'}" opacity=".6"/>`;
  let x = -20;
  const palette = ['#E9D8C3', '#D8C6B0', '#E5E1D8', '#CFD8D3', '#E8CFC0', '#D9CDBB'];
  while (x < W) {
    const w = 140 + r() * 200;
    const h = 220 + r() * 360;
    const y = 820 - h;
    b += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${pick(r, palette)}"/>`;
    if (r() > 0.5) b += `<path d="M${f(x - 6)} ${f(y)} L${f(x + w / 2)} ${f(y - 50)} L${f(x + w + 6)} ${f(y)}z" fill="#B0553B"/>`;
    for (let wy = y + 30; wy < 760; wy += 62) for (let wx = x + 20; wx < x + w - 36; wx += 46) b += `<rect x="${f(wx)}" y="${f(wy)}" width="26" height="36" rx="3" fill="${dusk && r() > 0.5 ? '#FFD98A' : '#8DB0C6'}" opacity=".9"/>`;
    if (r() > 0.55) b += `<rect x="${f(x + 10)}" y="${f(y + h * 0.45)}" width="${f(w - 20)}" height="44" fill="#7A5236"/><rect x="${f(x + 10)}" y="${f(y + h * 0.45 - 6)}" width="${f(w - 20)}" height="8" fill="#5E3E28"/>`;
    x += w + 4;
  }
  b += `<rect y="820" width="${W}" height="40" fill="#BDB6AC"/><rect y="860" width="${W}" height="${H - 860}" fill="url(#road)"/>`;
  for (let i = 0; i < 10; i++) b += `<rect x="${f(i * 180 + 30)}" y="960" width="100" height="10" rx="5" fill="#F2E8C9"/>`;
  for (let i = 0; i < 4; i++) b += `<rect x="${f(i * 420 + 150)}" y="640" width="8" height="180" fill="#2B3431"/><circle cx="${f(i * 420 + 154)}" cy="636" r="16" fill="${dusk ? '#FFD37A' : '#E9EEF0'}"/>`;
  const cx = 200 + r() * 1100;
  const cc = pick(r, ['#1E4A42', '#D8A31A', '#2F5FB8', '#B4492F', '#E9EEF0']);
  b += `<rect x="${f(cx)}" y="880" width="260" height="70" rx="26" fill="${cc}"/><path d="M${f(cx + 50)} 882 q30 -52 80 -52 h40 q40 0 70 52z" fill="${cc}"/><path d="M${f(cx + 74)} 878 q20 -34 56 -34 h30 q26 0 46 34z" fill="#CFE4F2"/><circle cx="${f(cx + 60)}" cy="952" r="24" fill="#1F2A27"/><circle cx="${f(cx + 200)}" cy="952" r="24" fill="#1F2A27"/>`;
  return svg(W, H, defs, b, 'ქუჩა');
}

function detail(seed: string) {
  const r = hash(seed);
  const P = pick(r, PALETTES);
  const W = 1600;
  const H = 1067;
  const defs = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.wall}"/><stop offset="1" stop-color="${P.wall2}"/></linearGradient><linearGradient id="steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9AA3A8"/><stop offset=".5" stop-color="#E6EBEE"/><stop offset="1" stop-color="#8E979C"/></linearGradient><radialGradient id="spot" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="#FFF6D8" stop-opacity=".8"/><stop offset="1" stop-color="#FFF6D8" stop-opacity="0"/></radialGradient><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky1}"/><stop offset="1" stop-color="${P.sky2}"/></linearGradient>`;
  const kind = pick(r, ['hood', 'meter', 'window'] as const);
  let b = `<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#spot)"/>`;
  if (kind === 'hood') {
    b += `<path d="M520 80 h560 v140 l180 260 h-920 l180 -260z" fill="url(#steel)"/><rect x="340" y="480" width="920" height="30" fill="#7E878C"/>`;
    for (let i = 0; i < 12; i++) b += `<rect x="${380 + i * 72}" y="430" width="40" height="36" rx="4" fill="#5F686D"/>`;
    b += `<rect x="260" y="760" width="1080" height="307" fill="#C9CFD2"/><rect x="260" y="740" width="1080" height="30" fill="#F4F6F7"/>`;
    for (let i = 0; i < 4; i++) b += `<circle cx="${400 + i * 260}" cy="820" r="70" fill="#2B3431"/><circle cx="${400 + i * 260}" cy="820" r="44" fill="none" stroke="#E2AA1C" stroke-width="8" opacity="${i % 2 ? 1 : 0.4}"/>`;
  } else if (kind === 'meter') {
    b += `<rect x="560" y="160" width="480" height="700" rx="24" fill="#F7F7F4" stroke="#C8CDD0" stroke-width="8"/><rect x="620" y="240" width="360" height="160" rx="12" fill="#1F2A27"/><text x="800" y="345" text-anchor="middle" font-family="monospace" font-size="84" fill="#7DF0C0">${Math.floor(10 + r() * 90)}kW</text>`;
    for (let i = 0; i < 3; i++) b += `<rect x="${640 + i * 110}" y="460" width="80" height="220" rx="10" fill="${[P.accent, P.accent2, '#B4492F'][i]}"/><rect x="${660 + i * 110}" y="${500 + i * 20}" width="40" height="60" rx="6" fill="#F7F7F4"/>`;
    b += `<path d="M800 860 C800 960 700 1000 600 1067" stroke="#1F2A27" stroke-width="24" fill="none"/><path d="M880 860 C880 960 980 1000 1080 1067" stroke="${P.accent2}" stroke-width="24" fill="none"/>`;
  } else {
    b += `<rect x="260" y="120" width="1080" height="780" rx="12" fill="${P.metal}"/><rect x="290" y="150" width="1020" height="720" fill="url(#sky)"/><path d="M290 700 Q560 560 800 640 T1310 600 V870 H290z" fill="#7FA08A"/><rect x="785" y="150" width="30" height="720" fill="${P.metal}"/>`;
    b += plant(420, 1000, 1.4) + plant(1250, 1010, 1.2, '#4FA16D') + `<rect x="200" y="900" width="1200" height="40" rx="8" fill="#F4EFE7"/>`;
  }
  return svg(W, H, defs, b, 'დეტალი');
}

function plan(seed: string) {
  const r = hash(seed);
  const W = 1600;
  const H = 1067;
  const defs = `<pattern id="tiles" width="36" height="36" patternUnits="userSpaceOnUse"><rect width="36" height="36" fill="#F4F1EA"/><path d="M36 0H0V36" fill="none" stroke="#E4DED2" stroke-width="2"/></pattern><pattern id="wood" width="80" height="20" patternUnits="userSpaceOnUse"><rect width="80" height="20" fill="#E3CCAA"/><path d="M0 19.5H80M40 0V20" stroke="#D2B891" stroke-width="1.5"/></pattern>`;
  const x = 220;
  const y = 150;
  const w = 1000 + r() * 120;
  const h = 700;
  const split = x + w * (0.55 + r() * 0.15);
  let b = `<rect width="${W}" height="${H}" fill="#FBFAF7"/><rect x="${x}" y="${y}" width="${f(w)}" height="${h}" fill="url(#wood)"/>`;
  b += `<rect x="${f(split)}" y="${y}" width="${f(x + w - split)}" height="${f(h * 0.45)}" fill="url(#tiles)"/><rect x="${f(split)}" y="${f(y + h * 0.45)}" width="${f(x + w - split)}" height="${f(h * 0.55)}" fill="#DCE9E3"/>`;
  b += `<rect x="${x}" y="${y}" width="${f(w)}" height="${h}" fill="none" stroke="#1F2A27" stroke-width="18"/>`;
  b += `<line x1="${f(split)}" y1="${y}" x2="${f(split)}" y2="${f(y + h * 0.3)}" stroke="#1F2A27" stroke-width="12"/><line x1="${f(split)}" y1="${f(y + h * 0.45)}" x2="${f(x + w)}" y2="${f(y + h * 0.45)}" stroke="#1F2A27" stroke-width="12"/><line x1="${f(split)}" y1="${f(y + h * 0.62)}" x2="${f(split)}" y2="${y + h}" stroke="#1F2A27" stroke-width="12"/>`;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b += `<circle cx="${f(x + 160 + i * 190)}" cy="${f(y + 200 + j * 250)}" r="54" fill="#FFFFFF" stroke="#1E4A42" stroke-width="5"/><circle cx="${f(x + 90 + i * 190)}" cy="${f(y + 200 + j * 250)}" r="18" fill="#1E4A42"/><circle cx="${f(x + 230 + i * 190)}" cy="${f(y + 200 + j * 250)}" r="18" fill="#1E4A42"/>`;
  b += `<rect x="${f(split + 40)}" y="${y + 40}" width="${f(x + w - split - 80)}" height="60" rx="10" fill="#1E4A42"/>`;
  b += `<rect x="${x + 90}" y="${y + h - 9}" width="120" height="18" fill="#FBFAF7"/><path d="M${x + 90} ${y + h} a120 120 0 0 1 120 -120" fill="none" stroke="#8A968F" stroke-width="4"/><rect x="${x + 360}" y="${y - 9}" width="260" height="18" fill="#9CC9F0"/>`;
  b += `<g stroke="#2F5FB8" stroke-width="3" fill="#2F5FB8" font-family="sans-serif" font-size="30"><line x1="${x}" y1="${y - 70}" x2="${f(x + w)}" y2="${y - 70}"/><line x1="${x}" y1="${y - 88}" x2="${x}" y2="${y - 52}"/><line x1="${f(x + w)}" y1="${y - 88}" x2="${f(x + w)}" y2="${y - 52}"/><text x="${f(x + w / 2)}" y="${y - 84}" text-anchor="middle" stroke="none">${f(w / 100)} m</text><line x1="${x - 70}" y1="${y}" x2="${x - 70}" y2="${y + h}"/><text x="${x - 90}" y="${y + h / 2}" text-anchor="middle" stroke="none" transform="rotate(-90 ${x - 90} ${y + h / 2})">${h / 100} m</text></g>`;
  b += `<circle cx="${f(x + w - 40)}" cy="${y + 40}" r="14" fill="#D8A31A"/>`;
  return svg(W, H, defs, b, 'ნახაზი');
}

function pano(seed: string) {
  const r = hash(seed);
  const W = 2400;
  const H = 900;
  const P = pick(r, PALETTES);
  const defs = `<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.wall}"/><stop offset="1" stop-color="${P.wall2}"/></linearGradient><linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.floor1}"/><stop offset="1" stop-color="${P.floor2}"/></linearGradient><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky1}"/><stop offset="1" stop-color="${P.sky2}"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="#FFE7A0" stop-opacity=".9"/><stop offset="1" stop-color="#FFE7A0" stop-opacity="0"/></radialGradient>`;
  let b = `<rect width="${W}" height="${H}" fill="url(#w)"/><path d="M0 640 Q1200 560 2400 640 V900 H0z" fill="url(#fl)"/>`;
  for (let i = 0; i < 4; i++) b += `<rect x="${120 + i * 600}" y="160" width="360" height="360" rx="8" fill="${P.metal}"/><rect x="${132 + i * 600}" y="172" width="336" height="336" fill="url(#sky)"/>`;
  b += plant(560, 760, 1.2) + plant(1780, 770, 1.1) + pendant(1200, 0, 160, P.accent2);
  return svg(W, H, defs, b, '360° ფოტო');
}

function document(seed: string) {
  const W = 1200;
  const H = 1600;
  let b = `<rect width="${W}" height="${H}" fill="#EEF2F0"/><rect x="120" y="100" width="960" height="1400" rx="12" fill="#fff"/><rect x="180" y="170" width="340" height="44" rx="8" fill="#1E4A42"/>`;
  for (let i = 0; i < 22; i++) b += `<rect x="180" y="${280 + i * 48}" width="${840 - ((i * 37 + seed.length * 13) % 300)}" height="14" rx="7" fill="#D5DCD8"/>`;
  b += `<circle cx="900" cy="1360" r="80" fill="none" stroke="#2F5FB8" stroke-width="8"/><path d="M860 1360 l30 30 l60 -60" stroke="#2F5FB8" stroke-width="10" fill="none"/>`;
  return svg(W, H, '', b, 'ამონაწერი');
}

const RENDERERS: Record<string, (seed: string) => string> = { interior, facade, street, detail, plan, pano, document };

export function placeholderSvg(kind: string, seed: string): string {
  return (RENDERERS[kind] ?? interior)(seed);
}

/** Raster variant for fast LCP: SVG → WebP, memoised (LRU-ish, 400 entries). */
const webpCache = new Map<string, Promise<Buffer>>();
export function renderPlaceholderWebp(kind: string, seed: string, width: number): Promise<Buffer> {
  const key = `${kind}/${seed}/${width}`;
  let hit = webpCache.get(key);
  if (!hit) {
    hit = sharp(Buffer.from(placeholderSvg(kind, seed)), { density: 72 }).resize({ width }).webp({ quality: 78 }).toBuffer();
    webpCache.set(key, hit);
    hit.catch(() => webpCache.delete(key));
    if (webpCache.size > 400) webpCache.delete(webpCache.keys().next().value as string);
  }
  return hit;
}
