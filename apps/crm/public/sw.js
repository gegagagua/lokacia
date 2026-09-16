/* lokacia CRM service worker (Phase 10 PWA shell; C23 offline mode extends the sync handler). */
const VERSION = 'lk-crm-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const SHELL_URLS = ['/offline', '/icon.svg', '/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // API is never cached (tenant data)

  if (url.pathname.startsWith('/_next/static/') || /\.(?:svg|png|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const net = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // keep the on-site capture page available offline (C23)
          if (res.ok && url.pathname === '/listings/new') caches.open(SHELL_CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match('/offline'))),
    );
  }
});

/* Background sync: ask open clients to flush the IndexedDB offline queue (see src/lib/offline-queue.ts). */
self.addEventListener('sync', (event) => {
  if (event.tag === 'lk-offline-queue') {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => clients.forEach((c) => c.postMessage({ type: 'lk:flush-queue' }))),
    );
  }
});

/* Web push (C5 reminders; the push provider is mocked in dev). */
self.addEventListener('push', (event) => {
  let data = { title: 'lokacia CRM', body: '', link: '/tasks' };
  try {
    data = { ...data, ...event.data.json() };
  } catch (_) {
    /* plain text */
  }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icon-192.png', badge: '/icon-192.png', data: { link: data.link } }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/dashboard';
  event.waitUntil(self.clients.openWindow(link));
});
