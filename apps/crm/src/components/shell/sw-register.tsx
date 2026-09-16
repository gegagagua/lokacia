'use client';
import * as React from 'react';

/** Registers the service worker (PWA install, offline shell, background sync). */
export function SwRegister() {
  React.useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);
  return null;
}
