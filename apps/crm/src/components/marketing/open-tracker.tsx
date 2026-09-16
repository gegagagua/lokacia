'use client';
import * as React from 'react';

/** Records one presentation open per browser session (skipped for the agent's preview link). */
export function OpenTracker({ token }: { token: string }) {
  const sent = React.useRef(false);
  React.useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (new URLSearchParams(window.location.search).has('preview')) return;
    const key = `lk-pres-open:${token}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* private mode: still count */
    }
    void fetch(`/api/v1/crm/presentations/public/${encodeURIComponent(token)}/open`, { method: 'POST', keepalive: true }).catch(() => undefined);
  }, [token]);
  return null;
}
