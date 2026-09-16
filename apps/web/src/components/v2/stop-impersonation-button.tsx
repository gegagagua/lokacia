'use client';
import * as React from 'react';
import { Button } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';

export function StopImpersonationButton({ label }: { label: string }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await apiFetch<{ redirectUrl: string }>('/admin/impersonation/stop', { method: 'POST' });
          window.location.href = r.redirectUrl;
        } catch {
          window.location.href = '/';
        }
      }}
    >
      {label}
    </Button>
  );
}
