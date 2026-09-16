'use client';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Button, IconButton } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';

async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
  window.location.href = '/login';
}

export function LogoutButton({ compact, iconOnly }: { compact?: boolean; iconOnly?: boolean }) {
  const t = useTranslations('auth');
  if (iconOnly)
    return (
      <IconButton label={t('logout')} size="sm" className="rounded-full text-muted hover:text-danger" onClick={logout}>
        <LogOut className="size-[18px]" strokeWidth={2} />
      </IconButton>
    );
  return (
    <Button variant={compact ? 'ghost' : 'danger'} size="sm" icon={<LogOut className="size-4" strokeWidth={2} aria-hidden />} onClick={logout}>
      {t('logout')}
    </Button>
  );
}
