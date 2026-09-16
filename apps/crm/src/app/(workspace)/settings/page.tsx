'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Building, ChevronRight, GitBranch, Shuffle, Target, UserRound, type LucideIcon } from 'lucide-react';
import type { CrmPermission } from '@lokacia/contracts';
import { PageHeader } from '@/components/common/page-header';
import { useCrm } from '@/lib/crm-context';

const CARDS: { key: 'pipeline' | 'organization' | 'distribution' | 'profile' | 'sources'; href: string; icon: LucideIcon; perm?: CrmPermission }[] = [
  { key: 'profile', href: '/settings/profile', icon: UserRound },
  { key: 'pipeline', href: '/settings/pipeline', icon: GitBranch, perm: 'pipeline.manage' },
  { key: 'organization', href: '/settings/organization', icon: Building, perm: 'settings.manage' },
  { key: 'distribution', href: '/team#distribution', icon: Shuffle, perm: 'team.manage' },
  { key: 'sources', href: '/sources', icon: Target, perm: 'finance.view' },
];

export default function SettingsPage() {
  const t = useTranslations('team.settings');
  const { can } = useCrm();
  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ul className="grid gap-3 md:grid-cols-2">
        {CARDS.filter((c) => !c.perm || can(c.perm)).map((c) => {
          const Icon = c.icon;
          return (
            <li key={c.key}>
              <Link href={c.href} className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 hover:border-border-strong">
                <span className="grid size-10 place-items-center rounded-button border border-border-strong text-primary">
                  <Icon className="size-5" strokeWidth={1.5} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t(c.key)}</span>
                  <span className="block text-small text-muted">{t(`${c.key}Hint`)}</span>
                </span>
                <ChevronRight className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
