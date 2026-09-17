import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Monorepo: single .env at the repo root.
loadEnvConfig(path.resolve(process.cwd(), '../..'));
import createNextIntlPlugin from 'next-intl/plugin';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
/** Sub-path hosting (e.g. /lokacia); unset at a domain root. Must be set for both `next build` and `next start`. */
const BASE_PATH = (process.env.NEXT_BASE_PATH ?? '').replace(/\/$/, '');

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '') + ' https://challenges.cloudflare.com',
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.openstreetmap.org https://api.maptiler.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.openstreetmap.org https://api.maptiler.com https://demotiles.maplibre.org " + (process.env.NODE_ENV === 'development' ? 'ws://localhost:4000 ' : '') + API_URL.replace(/^http/, 'ws'),
      "worker-src 'self' blob:",
      "frame-src 'self' https://challenges.cloudflare.com https://meet.jit.si https://www.youtube.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const config: NextConfig = {
  basePath: BASE_PATH || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@lokacia/ui', '@lokacia/contracts'],
  typedRoutes: false,
  images: { dangerouslyAllowSVG: true, contentDispositionType: 'inline', localPatterns: [{ pathname: `${BASE_PATH}/api/v1/media/**` }] },
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_URL}/v1/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(config);
