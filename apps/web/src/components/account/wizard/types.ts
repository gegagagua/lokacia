import { PASSPORT_KEYS, type DealType, type ListingDetail, type ListingStatus, type PassportKey } from '@lokacia/contracts';

export type BusinessTypeOption = {
  slug: string;
  nameKa: string;
  filterConfig: { filters: { key: string; kind: 'boolean' | 'min'; labelKa: string; unit?: string }[]; required: string[] };
};

export type MediaEntry = { id: string; url: string; kind: 'photo' | 'video' | 'plan' | 'pano360' | 'document'; isFloorplan: boolean; status: 'uploading' | 'processing' | 'ready' | 'failed'; progress?: number; name?: string };
export type EquipmentRow = { name: string; qty: string; price: string };
export type HistoryRow = { businessName: string; businessType: string; startedAt: string; endedAt: string; note: string };

export type WizardForm = {
  businessTypes: string[];
  dealType: DealType;
  isOwner: boolean;
  commissionPct: string;
  orgId: string | null;
  lat: number | null;
  lng: number | null;
  address: string;
  districtId: string | null;
  districtName: string | null;
  areaM2: string;
  floor: string;
  floorsTotal: string;
  passport: Partial<Record<PassportKey, boolean | number | null>>;
  media: MediaEntry[];
  videoUrl: string;
  tourUrl: string;
  price: string;
  priceHour: string;
  priceDay: string;
  serviceFee: string;
  depositMonths: string;
  utilitiesIncluded: boolean;
  equipment: EquipmentRow[];
  projectId: string;
  completionDate: string;
  history: HistoryRow[];
  title: string;
  description: string;
  descriptionEn: string;
  descriptionRu: string;
};

export type ExistingListing = { id: string; slug: string; status: ListingStatus; rejectReason: string | null; isOwner: boolean };

export const STEP_KEYS = ['type', 'location', 'passport', 'media', 'price', 'describe', 'review'] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export function emptyForm(): WizardForm {
  return {
    businessTypes: [],
    dealType: 'rent',
    isOwner: true,
    commissionPct: '',
    orgId: null,
    lat: null,
    lng: null,
    address: '',
    districtId: null,
    districtName: null,
    areaM2: '',
    floor: '',
    floorsTotal: '',
    passport: {},
    media: [],
    videoUrl: '',
    tourUrl: '',
    price: '',
    priceHour: '',
    priceDay: '',
    serviceFee: '',
    depositMonths: '1',
    utilitiesIncluded: false,
    equipment: [],
    projectId: '',
    completionDate: '',
    history: [],
    title: '',
    description: '',
    descriptionEn: '',
    descriptionRu: '',
  };
}

const toStr = (v: number | null | undefined, div = 1) => (v == null ? '' : String(v / div));

export function formFromDetail(d: ListingDetail): WizardForm {
  const passport: WizardForm['passport'] = {};
  for (const k of PASSPORT_KEYS) {
    const v = d.passport[k];
    if (v !== null && v !== undefined) passport[k] = v as boolean | number;
  }
  return {
    businessTypes: d.businessTypes,
    dealType: d.dealType,
    isOwner: d.isOwner,
    commissionPct: toStr(d.commissionPct),
    orgId: d.orgId,
    lat: d.lat,
    lng: d.lng,
    address: d.address,
    districtId: d.districtId,
    districtName: d.districtName,
    areaM2: toStr(d.areaM2),
    floor: toStr(d.floor),
    floorsTotal: toStr(d.floorsTotal),
    passport,
    media: d.media.map((m) => ({ id: m.id, url: m.variants?.sm ?? m.variants?.md ?? m.url, kind: m.kind, isFloorplan: !!m.isFloorplan, status: 'ready' as const })),
    videoUrl: d.videoUrl ?? '',
    tourUrl: d.tourUrl ?? '',
    price: toStr(d.priceMinor, 100),
    priceHour: toStr(d.priceHourMinor, 100),
    priceDay: toStr(d.priceDayMinor, 100),
    serviceFee: d.serviceFeeMinor ? toStr(d.serviceFeeMinor, 100) : '',
    depositMonths: toStr(d.depositMonths),
    utilitiesIncluded: d.utilitiesIncluded,
    equipment: d.equipment.map((e) => ({ name: e.name, qty: String(e.qty), price: toStr(e.priceMinor, 100) })),
    projectId: d.projectId ?? '',
    completionDate: d.completionDate ?? '',
    history: d.history.map((h) => ({ businessName: h.businessName, businessType: h.businessType ?? '', startedAt: h.startedAt, endedAt: h.endedAt ?? '', note: h.note ?? '' })),
    title: d.title,
    description: d.description,
    descriptionEn: d.descriptionEn ?? '',
    descriptionRu: d.descriptionRu ?? '',
  };
}

const num = (s: string) => {
  const n = Number(String(s).replace(',', '.').replace(/\s/g, ''));
  return s.trim() !== '' && Number.isFinite(n) ? n : null;
};
export const money = (s: string) => {
  const n = num(s);
  return n == null ? null : Math.round(n * 100);
};
export { num as parseNum };

/** Provisional title for autosaved drafts before the owner writes one. */
export type TitleLabels = { fallback: string; areaUnit: string };
export function suggestTitle(f: WizardForm, types: BusinessTypeOption[], labels: TitleLabels) {
  const bt = types.find((t) => t.slug === f.businessTypes[0])?.nameKa ?? labels.fallback;
  const area = num(f.areaM2);
  return [`${bt}${area ? `, ${area} ${labels.areaUnit}` : ''}`, f.districtName].filter(Boolean).join(' — ');
}

/** Wizard form → API listing input (full object; the wizard diffs it before PATCH). */
export function toPayload(f: WizardForm, types: BusinessTypeOption[], labels: TitleLabels) {
  const passport: Record<string, boolean | number | null> = {};
  for (const k of PASSPORT_KEYS) passport[k] = f.passport[k] ?? null;
  const title = f.title.trim().length >= 5 ? f.title.trim() : suggestTitle(f, types, labels);
  return {
    businessTypes: f.businessTypes,
    dealType: f.dealType,
    isOwner: f.orgId ? false : f.isOwner,
    commissionPct: !f.isOwner || f.orgId ? num(f.commissionPct) : null,
    title,
    description: f.description,
    descriptionEn: f.descriptionEn || null,
    descriptionRu: f.descriptionRu || null,
    address: f.address.trim(),
    districtId: f.districtId,
    lat: f.lat,
    lng: f.lng,
    areaM2: num(f.areaM2),
    floor: num(f.floor),
    floorsTotal: num(f.floorsTotal),
    priceMinor: money(f.price),
    priceHourMinor: f.dealType === 'short_term' ? money(f.priceHour) : null,
    priceDayMinor: f.dealType === 'short_term' ? money(f.priceDay) : null,
    serviceFeeMinor: money(f.serviceFee) ?? 0,
    depositMonths: num(f.depositMonths) ?? 0,
    utilitiesIncluded: f.utilitiesIncluded,
    projectId: f.projectId || null,
    completionDate: f.completionDate || null,
    videoUrl: f.videoUrl.trim() || null,
    tourUrl: f.tourUrl.trim() || null,
    passport,
    history: f.history.filter((h) => h.businessName.trim() && h.startedAt).map((h) => ({ businessName: h.businessName.trim(), businessType: h.businessType || null, startedAt: h.startedAt, endedAt: h.endedAt || null, note: h.note || null })),
    equipment: f.dealType === 'transfer' ? f.equipment.filter((e) => e.name.trim()).map((e) => ({ name: e.name.trim(), qty: Math.max(1, Math.round(num(e.qty) ?? 1)), priceMinor: money(e.price) ?? 0 })) : [],
    mediaIds: f.media.filter((m) => m.status !== 'failed' && m.status !== 'uploading').map((m) => m.id),
  };
}
export type ListingPayload = ReturnType<typeof toPayload>;

/** Enough data for POST /v1/listings (server validation). */
export function canCreate(p: ListingPayload) {
  return p.businessTypes.length > 0 && p.title.length >= 5 && p.address.length >= 3 && p.lat != null && p.lng != null && (p.areaM2 ?? 0) > 0 && (p.priceMinor ?? 0) > 0;
}

export function requiredKeys(f: WizardForm, types: BusinessTypeOption[]): PassportKey[] {
  const out = new Set<PassportKey>();
  for (const s of f.businessTypes) for (const k of types.find((t) => t.slug === s)?.filterConfig.required ?? []) out.add(k as PassportKey);
  return [...out];
}
export function relevantKeys(f: WizardForm, types: BusinessTypeOption[]): PassportKey[] {
  const out = new Set<PassportKey>(['widthM', 'depthM', 'ceilingM', 'powerKw']);
  for (const s of f.businessTypes) {
    const cfg = types.find((t) => t.slug === s)?.filterConfig;
    for (const k of cfg?.required ?? []) out.add(k as PassportKey);
    for (const x of cfg?.filters ?? []) out.add(x.key as PassportKey);
  }
  return PASSPORT_KEYS.filter((k) => out.has(k));
}
export function missingRequired(f: WizardForm, types: BusinessTypeOption[]) {
  return requiredKeys(f, types).filter((k) => f.passport[k] === undefined || f.passport[k] === null);
}
