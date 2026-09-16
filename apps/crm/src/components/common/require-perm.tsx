'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import type { CrmPermission } from '@lokacia/contracts';
import { EmptyState } from '@lokacia/ui';
import { useCrm } from '@/lib/crm-context';

/** Page-level guard mirroring the API permission check (C17). */
export function RequirePerm({ perm, children }: { perm: CrmPermission; children: React.ReactNode }) {
  const t = useTranslations('shell.common');
  const { can } = useCrm();
  if (!can(perm)) return <EmptyState icon={<Lock className="size-5" strokeWidth={2} aria-hidden />} title={t('noAccess')} />;
  return <>{children}</>;
}
