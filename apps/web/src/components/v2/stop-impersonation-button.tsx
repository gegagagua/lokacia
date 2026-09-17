'use client';
import * as React from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { withBase } from '@/lib/base-path';

export function StopImpersonationButton({ label }: { label: string }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      className="bg-[#17201d] text-[#fff8e6] shadow-sm hover:bg-[#0a110f]"
      loading={busy}
      icon={<LogOut className="size-4" strokeWidth={2} aria-hidden />}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await apiFetch<{ redirectUrl: string }>('/admin/impersonation/stop', { method: 'POST' });
          window.location.href = withBase(r.redirectUrl);
        } catch {
          window.location.href = withBase('/');
        }
      }}
    >
      {label}
    </Button>
  );
}
