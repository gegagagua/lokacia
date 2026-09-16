import type { SearchFilters } from '@lokacia/contracts';

/**
 * Deterministic Georgian (plus basic en/ru) query parser. Used as:
 *  - the mock AI client in dev/test,
 *  - the fallback when the live model fails,
 *  - a pre-pass whose hints are given to the model.
 */

const LETTER = /[\p{L}\p{N}²/.-]+/gu;

const BUSINESS_ALIASES: [string, string[]][] = [
  ['cafe', ['კაფე', 'რესტორ', 'ბისტრო', 'ყავის', 'ყავა', 'სამზარეულ', 'ხინკლ', 'ხაჭაპურ', 'cafe', 'restaurant', 'coffee', 'кафе', 'ресторан', 'кофейн']],
  ['bar', ['ბარი', 'ბარის', 'ბარისთვის', 'ბარს', 'პაბ', 'bar', 'pub', 'бар']],
  ['bakery', ['საცხობ', 'თონ', 'კონდიტერ', 'bakery', 'пекарн']],
  ['pharmacy', ['აფთიაქ', 'pharmacy', 'аптек']],
  ['beauty-salon', ['სალონ', 'ბარბერ', 'სილამაზ', 'salon', 'barber', 'салон']],
  ['clinic', ['კლინიკ', 'სტომატოლ', 'სამედიცინ', 'clinic', 'клиник']],
  ['coworking', ['კოვორკ', 'coworking', 'коворкинг']],
  ['office', ['ოფის', 'office', 'офис']],
  ['warehouse', ['საწყობ', 'სასაწყობ', 'ლოჯისტ', 'warehouse', 'склад']],
  ['production', ['საწარმო', 'საამქრო', 'წარმოებ', 'production', 'factory', 'производ', 'цех']],
  ['showroom', ['შოურუმ', 'showroom', 'шоурум']],
  ['car-service', ['ავტოსერვის', 'ვულკანიზ', 'ავტოსამრეცხ', 'სტო', 'car-service', 'автосервис']],
  ['fitness', ['ფიტნეს', 'სპორტ', 'იოგ', 'დარბაზ', 'fitness', 'gym', 'фитнес', 'спортзал']],
  ['education', ['სასწავლ', 'სკოლ', 'ბაღ', 'კურს', 'education', 'school', 'учебн']],
  ['pop-up', ['პოპ-აპ', 'პოპაპ', 'pop-up', 'popup', 'поп-ап']],
  ['retail', ['მაღაზი', 'სავაჭრ', 'ბუტიკ', 'მარკეტ', 'ვაჭრობ', 'retail', 'shop', 'store', 'магазин']],
];

/** District slug → stems (Georgian case endings are stripped by prefix match). */
const DISTRICT_ALIASES: [string, string[]][] = [
  ['vake', ['ვაკ', 'vake', 'ваке']],
  ['saburtalo', ['საბურთალ', 'saburtalo', 'сабуртало']],
  ['mtatsminda', ['მთაწმინდ', 'mtatsminda', 'мтацминд']],
  ['vera', ['ვერა', 'ვერაზე', 'ვერაში', 'vera', 'вера']],
  ['sololaki', ['სოლოლაკ', 'sololaki', 'сололак']],
  ['old-tbilisi', ['ძველ-თბილის', 'old-tbilisi', 'старый']],
  ['chughureti', ['ჩუღურეთ', 'chughureti', 'чугурет']],
  ['didube', ['დიდუბ', 'didube', 'дидубе']],
  ['nadzaladevi', ['ნაძალადევ', 'nadzaladevi', 'надзаладеви']],
  ['isani', ['ისან', 'isani', 'исани']],
  ['samgori', ['სამგორ', 'samgori', 'самгори']],
  ['krtsanisi', ['კრწანის', 'krtsanisi', 'крцанис']],
  ['gldani', ['გლდან', 'gldani', 'глдани']],
  ['didi-dighomi', ['დიღომ', 'dighomi', 'дигоми']],
  ['bagebi', ['ბაგებ', 'bagebi', 'багеби']],
  ['avlabari', ['ავლაბარ', 'avlabari', 'авлабар']],
];

const CITY_ALIASES: [string, string[]][] = [
  ['batumi', ['ბათუმ', 'batumi', 'батуми']],
  ['kutaisi', ['ქუთაის', 'kutaisi', 'кутаиси']],
  ['rustavi', ['რუსთავ', 'rustavi', 'рустави']],
  ['tbilisi', ['თბილის', 'tbilisi', 'тбилиси']],
];

const hasStem = (tokens: string[], stems: string[]) => tokens.some((t) => stems.some((s) => t.startsWith(s)));

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ძველ(ი|ს|ში)?\s+თბილის/g, 'ძველ-თბილის')
    .replace(/old\s+tbilisi/g, 'old-tbilisi')
    .replace(/(\d)\s+(?=\d{3}(?!\d))/g, '$1') // "3 000" → "3000"
    .replace(/(\d)[.,](\d{3})(?!\d)/g, '$1$2')
    .replace(/(\d+(?:[.,]\d+)?)\s*k\b/g, (_, n: string) => String(Number(n.replace(',', '.')) * 1000))
    .replace(/კვ\.?\s?მ\.?|მ2|m2|sqm|кв\.?\s?м\.?|м2/g, 'მ²');
}

type NumToken = { value: number; unit: 'area' | 'price' | 'height' | 'power' | 'usd' | null; mod: 'max' | 'min' | null; index: number };

function numbers(text: string): NumToken[] {
  const out: NumToken[] = [];
  const re = /(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(მ²|მ(?![\p{L}])|m(?![\p{L}])|м(?![\p{L}])|ლარ\S*|₾|gel\S*|лар\S*|\$|usd|დოლარ\S*|კვტ|kw|квт)?\s*(?:-?(მდე|ამდე)|-?(დან))?/giu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!m[1]) continue;
    const value = Number(m[1].replace(',', '.'));
    const rawUnit = (m[3] ?? '').toLowerCase();
    const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
    const before = text.slice(Math.max(0, m.index - 14), m.index);
    let unit: NumToken['unit'] = null;
    if (rawUnit.startsWith('მ²')) unit = 'area';
    else if (/^(ლარ|₾|gel|лар)/.test(rawUnit)) unit = 'price';
    else if (/^(\$|usd|დოლარ)/.test(rawUnit)) unit = 'usd';
    else if (/^(კვტ|kw|квт)/.test(rawUnit)) unit = 'power';
    else if (/^(მ|m|м)$/.test(rawUnit) && /(ჭერ|ceiling|потол)/.test(before + tail)) unit = 'height';
    else if (/^(მ|m|м)$/.test(rawUnit)) unit = value <= 8 ? 'height' : 'area';
    let mod: NumToken['mod'] = null;
    if (m[4] || /^(-?მდე|-?ამდე|\s*(მაქს|до|max|under))/.test(tail) || /(მაქს|до|under|up to|below)\s*$/.test(before)) mod = 'max';
    if (m[5] || /^\s*-?(დან|\+|from|от)/.test(tail) || /(მინ|от|from|at least|min)\s*$/.test(before) || text[m.index + m[0].length - 1] === '+') mod = 'min';
    out.push({ value, unit, mod, index: m.index });
    if (m[2]) out.push({ value: Number(m[2].replace(',', '.')), unit, mod: 'max', index: m.index + 1 });
    if (m[2]) out[out.length - 2]!.mod = 'min';
  }
  return out;
}

export function parseSearchText(input: string): SearchFilters {
  const text = normalize(input);
  const tokens = text.match(LETTER) ?? [];
  const filters: SearchFilters = {};

  for (const [slug, stems] of BUSINESS_ALIASES) {
    if (hasStem(tokens, stems)) {
      filters.businessType = slug;
      break;
    }
  }

  const districts = DISTRICT_ALIASES.filter(([, stems]) => hasStem(tokens, stems)).map(([slug]) => slug);
  if (districts.length) filters.districts = districts;
  for (const [slug, stems] of CITY_ALIASES) {
    if (hasStem(tokens, stems)) {
      filters.city = slug;
      break;
    }
  }

  if (hasStem(tokens, ['გადაცემ', 'გადაბარ', 'მზა-ბიზნეს', 'transfer', 'передач', 'готовый'])) filters.dealType = 'transfer';
  else if (hasStem(tokens, ['საათობრ', 'დღიურ', 'ხანმოკლ', 'საათით', 'hourly', 'почасов', 'short-term', 'краткосроч'])) filters.dealType = 'short_term';
  else if (hasStem(tokens, ['იყიდ', 'ყიდვ', 'შესყიდ', 'buy', 'sale', 'купить', 'продаж'])) filters.dealType = 'sale';
  else if (hasStem(tokens, ['ქირ', 'იჯარ', 'rent', 'аренд', 'снять'])) filters.dealType = 'rent';
  if (/მზა ბიზნეს|ready business|готовый бизнес/.test(text)) filters.dealType = 'transfer';

  if (hasStem(tokens, ['გამწოვ', 'hood', 'вытяжк'])) filters.hasHood = true;
  if (hasStem(tokens, ['აირ', 'გაზ', 'gas', 'газ'])) filters.hasGas = true;
  if (hasStem(tokens, ['ვიტრინ', 'shopfront', 'витрин'])) filters.shopWindow = true;
  if (/სამფაზ|3\s*ფაზ|three[- ]phase|трехфаз|3\s*фаз/.test(text)) filters.threePhase = true;
  if (/24\/7|24 საათ|круглосуточ|non-stop/.test(text)) filters.access247 = true;
  if (hasStem(tokens, ['სატვირთ', 'ფურ', 'truck', 'фур', 'грузов'])) filters.truckAccess = true;
  if (hasStem(tokens, ['პარკინგ', 'ავტოსადგომ', 'parking', 'парковк'])) filters.parking = 1;
  if (/ცალკე შესასვლ|separate entrance|отдельн\S* вход/.test(text)) filters.separateEntrance = true;
  if (/მესაკუთრ\S*(გან|დან)|ბროკერ\S* გარეშე|შუამავლ\S* გარეშე|from owner|без посредник|от собственник/.test(text)) filters.onlyOwners = true;
  if (/ვერიფიც|დადასტურებულ მესაკუთრ|verified/.test(text)) filters.verifiedOnly = true;
  if (/მშენებლ|off-plan|ახალ კორპუს|строящ/.test(text)) filters.offPlan = true;

  for (const n of numbers(text)) {
    if (n.unit === 'area') {
      if (n.mod === 'max') filters.areaMax = n.value;
      else if (n.mod === 'min') filters.areaMin = n.value;
      else {
        filters.areaMin = Math.round(n.value * 0.8);
        filters.areaMax = Math.round(n.value * 1.3);
      }
    } else if (n.unit === 'price' || n.unit === 'usd') {
      const gel = n.unit === 'usd' ? Math.round(n.value * 2.7) : n.value;
      if (n.mod === 'min') filters.priceMin = gel;
      else filters.priceMax = gel;
    } else if (n.unit === 'height') filters.ceilingM = n.value;
    else if (n.unit === 'power') filters.powerKw = n.value;
  }

  if (filters.businessType === 'pop-up' && !filters.dealType) filters.dealType = 'short_term';
  if (!filters.businessType && !filters.districts && Object.keys(filters).length === 0) filters.q = input.trim().slice(0, 200);
  return filters;
}

export const PARSER_VOCAB = { BUSINESS_ALIASES, DISTRICT_ALIASES, CITY_ALIASES };
