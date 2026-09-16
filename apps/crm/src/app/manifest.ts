import type { MetadataRoute } from 'next';

/** PWA manifest (Phase 10 shell, C23 mobile mode). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'lokacia CRM — ბროკერის სამუშაო სივრცე',
    short_name: 'lokacia CRM',
    description: 'კლიენტები, გარიგებები, ჩვენებები და ფართები ერთ ადგილას.',
    start_url: '/dashboard?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#EDF0EB',
    theme_color: '#1E4A42',
    lang: 'ka',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'ფართის დამატება ადგილზე', url: '/listings/new', icons: [{ src: '/icon.svg', sizes: 'any' }] },
      { name: 'დავალებები', url: '/tasks', icons: [{ src: '/icon.svg', sizes: 'any' }] },
      { name: 'ჩვენებები', url: '/calendar', icons: [{ src: '/icon.svg', sizes: 'any' }] },
    ],
  };
}
