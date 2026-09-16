import { z } from 'zod';
import { searchFiltersSchema, type SearchFilters, BUSINESS_TYPE_BY_SLUG, PASSPORT_FIELDS, formatMoney } from '@lokacia/contracts';
import type { AiClient } from './client';
import { ADVICE_SYSTEM, DESCRIBE_SYSTEM, SCORE_SYSTEM, SEARCH_PARSE_SYSTEM } from './prompts';
import { parseSearchText } from './rules/search-parser';

/** Plain JSON schema for the model (no preprocess/coercion). Result is re-validated with searchFiltersSchema. */
export const aiFilterSchema = z.object({
  q: z.string().optional(),
  businessType: z.string().optional(),
  dealType: z.enum(['rent', 'sale', 'transfer', 'short_term']).optional(),
  city: z.string().optional(),
  districts: z.array(z.string()).optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  areaMin: z.number().optional(),
  areaMax: z.number().optional(),
  onlyOwners: z.boolean().optional(),
  offPlan: z.boolean().optional(),
  hasHood: z.boolean().optional(),
  hasGas: z.boolean().optional(),
  shopWindow: z.boolean().optional(),
  threePhase: z.boolean().optional(),
  access247: z.boolean().optional(),
  truckAccess: z.boolean().optional(),
  separateEntrance: z.boolean().optional(),
  ceilingM: z.number().optional(),
  powerKw: z.number().optional(),
  parking: z.number().optional(),
});

export async function parseSearch(ai: AiClient, text: string): Promise<{ filters: SearchFilters; source: 'ai' | 'rules' | 'fallback' }> {
  const rules = parseSearchText(text);
  if (!ai.live) return { filters: rules, source: 'rules' };
  try {
    const out = await ai.json({ purpose: 'search.parse', system: SEARCH_PARSE_SYSTEM, prompt: text, schema: aiFilterSchema, maxTokens: 1024 });
    const parsed = out ? searchFiltersSchema.safeParse(out) : null;
    if (parsed?.success) {
      const f = parsed.data;
      if (f.businessType && !BUSINESS_TYPE_BY_SLUG[f.businessType]) delete f.businessType;
      return { filters: f, source: 'ai' };
    }
  } catch {
    // fall through to deterministic parser
  }
  return { filters: rules, source: 'fallback' };
}

export type ListingFacts = {
  title: string;
  businessTypes: string[];
  dealType: string;
  areaM2: number;
  floor?: number | null;
  address: string;
  district?: string | null;
  priceMinor: number;
  passport: Record<string, unknown>;
};

export const describeOutputSchema = z.object({ ka: z.string(), en: z.string(), ru: z.string() });
export type Descriptions = z.infer<typeof describeOutputSchema>;

function factsText(f: ListingFacts) {
  const specs = PASSPORT_FIELDS.filter((p) => f.passport[p.key] !== undefined && f.passport[p.key] !== null && f.passport[p.key] !== false)
    .map((p) => (p.kind === 'boolean' ? p.labelKa : `${p.labelKa}: ${f.passport[p.key]}${p.unit ? ` ${p.unit}` : ''}`))
    .join('; ');
  return `სათაური: ${f.title}\nტიპი: ${f.businessTypes.map((b) => BUSINESS_TYPE_BY_SLUG[b]?.nameKa ?? b).join(', ')}\nგარიგება: ${f.dealType}\nფართი: ${f.areaM2} მ²\nქანობი: ${f.floor ?? '—'}\nმისამართი: ${f.address}${f.district ? ` (${f.district})` : ''}\nფასი: ${formatMoney(f.priceMinor)}\nპასპორტი: ${specs || '—'}`;
}

/** Template-based descriptions (mock + fallback). */
export function templateDescriptions(f: ListingFacts): Descriptions {
  const bt = f.businessTypes.map((b) => BUSINESS_TYPE_BY_SLUG[b]).filter(Boolean);
  const specsKa = PASSPORT_FIELDS.filter((p) => f.passport[p.key] === true).map((p) => p.labelKa.toLowerCase());
  const nums = [
    f.passport.powerKw ? `სიმძლავრე ${f.passport.powerKw} კვტ` : null,
    f.passport.ceilingM ? `ჭერი ${f.passport.ceilingM} მ` : null,
    f.passport.facadeM ? `ფასადი ${f.passport.facadeM} მ` : null,
  ].filter(Boolean);
  const ka = [
    `${f.areaM2} მ² ფართი ${f.district ? `${f.district}ში` : ''}, მისამართი: ${f.address}.`,
    bt.length ? `შესაფერისია: ${bt.map((b) => b!.nameKa.toLowerCase()).join(', ')}.` : '',
    nums.length ? `ტექნიკური მაჩვენებლები: ${nums.join(', ')}.` : '',
    specsKa.length ? `ფართს აქვს: ${specsKa.join(', ')}.` : '',
    `ქანობი: ${f.floor ?? 'პირველი'}. ფასი: ${formatMoney(f.priceMinor)}.`,
  ].filter(Boolean).join(' ');
  const en = `${f.areaM2} m² commercial space at ${f.address}${bt.length ? `, suited for ${bt.map((b) => b!.nameEn.toLowerCase()).join(', ')}` : ''}.${nums.length ? ` Power ${f.passport.powerKw ?? '—'} kW, ceiling ${f.passport.ceilingM ?? '—'} m.` : ''} Price: ${f.priceMinor / 100} GEL.`;
  const ru = `Коммерческое помещение ${f.areaM2} м² по адресу ${f.address}${bt.length ? `, подходит под: ${bt.map((b) => b!.nameRu.toLowerCase()).join(', ')}` : ''}. Цена: ${f.priceMinor / 100} GEL.`;
  return { ka, en, ru };
}

export async function describeListing(ai: AiClient, facts: ListingFacts): Promise<Descriptions & { source: 'ai' | 'template' }> {
  if (ai.live) {
    try {
      const out = await ai.json({ purpose: 'listing.describe', system: DESCRIBE_SYSTEM, prompt: `Write ka, en, ru descriptions from these facts:\n${factsText(facts)}`, schema: describeOutputSchema, maxTokens: 4096 });
      if (out) return { ...out, source: 'ai' };
    } catch {
      // template fallback
    }
  }
  return { ...templateDescriptions(facts), source: 'template' };
}

export type AdviceFinding = { key: string; severity: 'high' | 'medium' | 'low'; messageKa: string };

export async function explainAdvice(ai: AiClient, findings: AdviceFinding[], context: string): Promise<string | null> {
  if (!ai.live || !findings.length) return null;
  try {
    return await ai.text({ purpose: 'stats.advice', system: ADVICE_SYSTEM, prompt: `${context}\n\nFindings:\n${findings.map((f) => `- [${f.severity}] ${f.messageKa}`).join('\n')}`, maxTokens: 1024 });
  } catch {
    return null;
  }
}

export async function summarizeScore(ai: AiClient, input: { score: number; businessType: string; components: { label: string; value: number }[] }): Promise<string> {
  const sorted = [...input.components].sort((a, b) => b.value - a.value);
  const fallback = `ქულა ${input.score}/100. ძლიერი მხარე: ${sorted[0]?.label.toLowerCase() ?? '—'} (${sorted[0]?.value ?? 0}); სუსტი მხარე: ${sorted.at(-1)?.label.toLowerCase() ?? '—'} (${sorted.at(-1)?.value ?? 0}).`;
  if (!ai.live) return fallback;
  try {
    return (await ai.text({ purpose: 'score.summary', system: SCORE_SYSTEM, prompt: JSON.stringify(input), maxTokens: 512 })) ?? fallback;
  } catch {
    return fallback;
  }
}
