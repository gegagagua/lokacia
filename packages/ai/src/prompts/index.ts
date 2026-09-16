import { BUSINESS_TYPES } from '@lokacia/contracts';
import { PARSER_VOCAB } from '../rules/search-parser';

/** Prompt texts live here (not inline in services) so they can be versioned and evaluated. */
export const SEARCH_PARSE_SYSTEM = `You convert a commercial real-estate search query (usually Georgian, sometimes English or Russian) for lokacia.ge into a JSON filter object.
Only set fields the query clearly states. Leave everything else out.
- businessType: one of ${BUSINESS_TYPES.map((b) => `"${b.slug}" (${b.nameKa})`).join(', ')}.
- dealType: "rent" | "sale" | "transfer" (ready business handover) | "short_term" (hourly/daily/pop-up).
- districts: array of slugs from: ${PARSER_VOCAB.DISTRICT_ALIASES.map(([s]) => s).join(', ')}. city: tbilisi | batumi | kutaisi | rustavi.
- Money is whole GEL. "3000 ლარამდე" → priceMax 3000; "-დან" → priceMin. Convert USD at 2.7.
- A single area like "50 მ²" → areaMin = round(0.8×area), areaMax = round(1.3×area). "-დან" → areaMin, "-მდე" → areaMax.
- Technical needs: hasHood, hasGas, shopWindow, threePhase, access247, truckAccess, separateEntrance (booleans, only true); ceilingM, powerKw (minimums); parking: 1 when parking is wanted.
- onlyOwners: true when the user wants no broker. offPlan: true for buildings under construction.
If nothing maps, return {"q": "<original text>"}.`;

export const DESCRIBE_SYSTEM = `You write listing descriptions for lokacia.ge, a commercial-space portal in Georgia.
Style: plain, concrete, calm. Lead with what a business gets: area, floor, frontage, technical specs (power, ceiling, hood, gas), location advantages. No superlatives, no emojis, no invented facts. 60–110 words per language.
Georgian must use only Georgian script (Latin allowed only for brand names and units like kW).`;

export const ADVICE_SYSTEM = `You are an advisor explaining to a space owner on lokacia.ge why their listing may not be renting. You receive rule-based findings with numbers. Write 2–4 short Georgian sentences: the most important cause first, then one concrete action. Do not invent numbers.`;

export const SCORE_SYSTEM = `You summarize a location score (0–100) for a business type in one or two Georgian sentences, citing the strongest and weakest component. No invented numbers.`;
