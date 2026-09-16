#!/usr/bin/env node
// Georgian script check (CLAUDE.md): every string in apps/*/messages/ka/*.json must be Georgian text.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ALLOWED_LATIN = new Set(['lokacia', 'lokacia.ge', 'ge', 'VIP', 'CRM', 'API', 'PDF', 'XML', 'SMS', 'OTP', 'Google', 'Telegram', 'Viber', 'WhatsApp', 'Excel', 'CSV', 'XLSX', 'ICS', 'ID', 'KPI', 'ROI', 'AI', 'URL', 'PWA', 'QR', 'kW', 'GEL', 'USD', 'EUR', 'HoReCa', 'LiDAR', 'GLB', 'USDZ', 'OBJ', 'Sheets', 'Pro', 'Basic', 'e-mail', 'email', 'Jitsi', 'Meet', 'BOG', 'TBC', 'PSP', 'Facebook', 'Instagram', 'ss.ge', 'myhome.ge', 'English', 'Русский', 'x', 'm', 'Enter', 'Esc', 'Ctrl', 'K', 'Cmd', 'iOS', 'Android', 'OSM', 'OpenStreetMap', 'MapTiler', 'www', 'https', 'http', 'Wi', 'Fi', 'Wi-Fi', 'LED', 'IT', 'SEO', 'OG', 'JSON', 'GPS', 'IBAN', 'SWIFT', 'NDA', 'LLC']);
const GEORGIAN = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/u;

let errors = 0;
let checked = 0;
function walk(obj, file, trail) {
  for (const [k, v] of Object.entries(obj)) {
    const at = [...trail, k].join('.');
    if (typeof v === 'object' && v) walk(v, file, [...trail, k]);
    else if (typeof v === 'string') {
      checked++;
      const text = v.replace(/\{[^}]*\}/g, ' ').replace(/https?:\/\/\S+/g, ' ');
      for (const word of text.split(/[\s,.;:!?()«»„“"'/…·—–\-+*=<>[\]|#@&%₾²°№0-9]+/u).filter(Boolean)) {
        const hasGe = GEORGIAN.test(word);
        const hasLatin = /[A-Za-z]/.test(word);
        const hasCyr = /[Ѐ-ӿ]/.test(word);
        if (hasGe && (hasLatin || hasCyr)) {
          console.error(`${file}: ${at}: mixed scripts in word "${word}"`);
          errors++;
        } else if ((hasLatin || hasCyr) && !ALLOWED_LATIN.has(word)) {
          console.error(`${file}: ${at}: non-Georgian word "${word}"`);
          errors++;
        }
      }
    }
  }
}

for (const app of readdirSync('apps')) {
  const dir = path.join('apps', app, 'messages', 'ka');
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const file = path.join(dir, f);
    walk(JSON.parse(readFileSync(file, 'utf8')), file, []);
  }
}
if (errors) {
  console.error(`check:ka — ${errors} problem(s) in ${checked} strings`);
  process.exit(1);
}
console.log(`check:ka — ${checked} strings OK`);
