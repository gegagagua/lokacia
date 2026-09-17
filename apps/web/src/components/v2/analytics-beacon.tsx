'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { withBase } from '@/lib/base-path';

/** Privacy-friendly page views: no cookies, no ids — the API hashes ip+UA+day server-side. */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  React.useEffect(() => {
    if (!pathname) return;
    const body = JSON.stringify({ name: 'page_view', path: pathname });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(withBase('/api/v1/analytics/events'), new Blob([body], { type: 'application/json' }));
      } else {
        void fetch(withBase('/api/v1/analytics/events'), { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true, credentials: 'omit' });
      }
    } catch {
      /* analytics must never break the page */
    }
  }, [pathname]);
  return null;
}
