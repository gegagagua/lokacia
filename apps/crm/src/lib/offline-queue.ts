'use client';
import { apiFetch, uploadFile } from './api-client';

/**
 * C23 offline queue: on-site captures (fields + photo/audio Blobs + GPS) live in IndexedDB until they reach the API.
 * Flushed on `online`, on the service worker's background-sync message, and manually. Progress is persisted per item
 * (created listing id, uploaded file count) so a flush interrupted halfway resumes without duplicates.
 */
export type CaptureFields = { title: string; businessType: string; dealType: 'rent' | 'sale' | 'transfer' | 'short_term'; priceGel: number; areaM2: number; address: string; note: string };
export type QueuedCapture = {
  id: string;
  orgId: string;
  createdAt: string;
  fields: CaptureFields;
  lat: number;
  lng: number;
  photos: { name: string; blob: Blob }[];
  audio: { name: string; blob: Blob } | null;
  status: 'pending' | 'syncing' | 'error' | 'done';
  error?: string;
  listingId?: string;
  uploaded: number;
};

const DB = 'lk-crm-offline';
const STORE = 'captures';
const EVENT = 'lk:queue-changed';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    t.onerror = () => reject(t.error);
  });
}

const changed = () => window.dispatchEvent(new CustomEvent(EVENT));
export const onQueueChanged = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

export async function listQueue(): Promise<QueuedCapture[]> {
  const all = await tx<QueuedCapture[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedCapture[]>);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function putCapture(c: QueuedCapture) {
  await tx('readwrite', (s) => s.put(c));
  changed();
}

export async function removeCapture(id: string) {
  await tx('readwrite', (s) => s.delete(id));
  changed();
}

export async function enqueue(c: Omit<QueuedCapture, 'id' | 'createdAt' | 'status' | 'uploaded'>) {
  const item: QueuedCapture = { ...c, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'pending', uploaded: 0 };
  await putCapture(item);
  await requestBackgroundSync();
  return item;
}

export async function requestBackgroundSync() {
  try {
    const reg = (await navigator.serviceWorker?.ready) as (ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }) | undefined;
    await reg?.sync?.register('lk-offline-queue');
  } catch {
    /* Background Sync unsupported (Safari/Firefox) — the `online` listener flushes instead */
  }
}

/** Sends one capture: create draft listing (once) → upload remaining photos → voice note. */
export async function sendCapture(c: QueuedCapture): Promise<string> {
  let item = { ...c, status: 'syncing' as const, error: undefined };
  await putCapture(item);
  if (!item.listingId) {
    const f = item.fields;
    const listing = await apiFetch<{ id: string }>('/listings', {
      method: 'POST',
      orgId: item.orgId,
      body: {
        businessTypes: [f.businessType],
        dealType: f.dealType,
        title: f.title,
        description: f.note ?? '',
        address: f.address,
        lat: item.lat,
        lng: item.lng,
        areaM2: f.areaM2,
        priceMinor: Math.round(f.priceGel * 100),
        isOwner: false,
        submit: false,
      },
    });
    item = { ...item, listingId: listing.id };
    await putCapture(item);
  }
  const files = [...item.photos.map((p) => ({ ...p, kind: 'photo' as const })), ...(item.audio ? [{ ...item.audio, kind: 'document' as const }] : [])];
  for (let i = item.uploaded; i < files.length; i++) {
    const file = files[i]!;
    await uploadFile(file.blob, { kind: file.kind, fileName: file.name, listingId: item.listingId });
    item = { ...item, uploaded: i + 1 };
    await putCapture(item);
  }
  await removeCapture(item.id);
  return item.listingId!;
}

let flushing: Promise<number> | null = null;
/** Flushes the whole queue sequentially; returns number of sent captures. */
export function flushQueue(): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    if (!navigator.onLine) return 0;
    for (const c of await listQueue()) {
      try {
        await sendCapture(c);
        sent++;
      } catch (e) {
        await putCapture({ ...c, ...(await listQueue()).find((x) => x.id === c.id), status: 'error', error: e instanceof Error ? e.message : String(e) });
        if (!navigator.onLine) break;
      }
    }
    return sent;
  })().finally(() => (flushing = null));
  return flushing;
}

/** Wire automatic flushing (call once from the capture page / shell). */
export function installQueueAutoFlush() {
  const onOnline = () => void flushQueue();
  const onMessage = (e: MessageEvent) => {
    if ((e.data as { type?: string })?.type === 'lk:flush-queue') void flushQueue();
  };
  window.addEventListener('online', onOnline);
  navigator.serviceWorker?.addEventListener('message', onMessage);
  if (navigator.onLine) void flushQueue();
  return () => {
    window.removeEventListener('online', onOnline);
    navigator.serviceWorker?.removeEventListener('message', onMessage);
  };
}
