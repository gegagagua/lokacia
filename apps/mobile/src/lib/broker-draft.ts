import { listingInputSchema, type DealType } from '@lokacia/contracts';
import { gelToMinor } from './listing-format';

export type DraftFields = { businessType: string; dealType: DealType; title: string; address: string; area: string; price: string; note: string };
export type Coords = { lat: number; lng: number; accuracy?: number | null };

/**
 * On-site capture → draft listing body for POST /v1/listings (x-org-id, submit=false).
 * Validated with the shared `listingInputSchema` so the API never sees an invalid payload; returns null when incomplete.
 */
export function buildDraftListing(f: DraftFields, coords: Coords | null) {
  const priceMinor = gelToMinor(f.price);
  const areaM2 = Number(f.area.replace(/\s/g, '').replace(',', '.'));
  if (!coords || !priceMinor || !Number.isFinite(areaM2)) return null;
  const parsed = listingInputSchema.safeParse({
    businessTypes: [f.businessType],
    dealType: f.dealType,
    title: f.title,
    description: f.note,
    address: f.address,
    lat: Number(coords.lat.toFixed(6)),
    lng: Number(coords.lng.toFixed(6)),
    areaM2,
    priceMinor,
    isOwner: false,
  });
  return parsed.success ? parsed.data : null;
}

/** File name + MIME for picked/recorded assets (the API allow-lists content types). */
export function mediaMeta(uri: string, fallbackType: 'image' | 'audio', mimeType?: string | null, fileName?: string | null): { name: string; type: string } {
  const ext = (fileName ?? uri).split('?')[0]!.split('.').pop()?.toLowerCase() ?? '';
  const byExt: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/mp4', caf: 'audio/mp4', webm: 'audio/webm', wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg' };
  const type = mimeType && /^(image|audio)\//.test(mimeType) ? mimeType : (byExt[ext] ?? (fallbackType === 'image' ? 'image/jpeg' : 'audio/mp4'));
  const safeExt = ext && byExt[ext] ? ext : fallbackType === 'image' ? 'jpg' : 'm4a';
  const lastSegment = uri.split('?')[0]!.split('/').pop() ?? '';
  const source = fileName ?? (/\.[a-z0-9]{2,5}$/i.test(lastSegment) ? lastSegment : '');
  const base = source.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 80) || `${fallbackType === 'image' ? 'photo' : 'voice-note'}-${Date.now()}`;
  return { name: `${base}.${safeExt}`, type };
}
