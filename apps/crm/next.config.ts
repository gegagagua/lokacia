import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Monorepo: single .env at the repo root.
loadEnvConfig(path.resolve(process.cwd(), '../..'));

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const dev = process.env.NODE_ENV === 'development';

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // C23 mobile mode needs camera (photos), microphone (voice note) and geolocation (GPS)
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" + (dev ? " 'unsafe-eval'" : ''),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.openstreetmap.org https://api.maptiler.com",
      "media-src 'self' blob: data:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.openstreetmap.org https://api.maptiler.com https://demotiles.maplibre.org ws://localhost:4000 " + API_URL.replace(/^http/, 'ws'),
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "frame-src 'self' blob:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@lokacia/ui', '@lokacia/contracts'],
  typedRoutes: false,
  images: { dangerouslyAllowSVG: true, contentDispositionType: 'inline', localPatterns: [{ pathname: '/api/v1/media/**' }] },
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_URL}/v1/:path*` }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(config);
