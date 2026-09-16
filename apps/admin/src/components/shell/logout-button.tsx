'use client';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Button } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';

export function LogoutButton({ compact }: { compact?: boolean }) {
  const t = useTranslations('auth');
  return (
    <Button
      variant={compact ? 'ghost' : 'danger'}
      size="sm"
      icon={<LogOut className="size-4" strokeWidth={1.5} aria-hidden />}
      onClick={async () => {
        await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
        window.location.href = '/login';
      }}
    >
      {t('logout')}
    </Button>
  );
}
