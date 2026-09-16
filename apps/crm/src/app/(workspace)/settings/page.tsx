'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, Building, GitBranch, Shuffle, Target, UserRound, type LucideIcon } from 'lucide-react';
import type { CrmPermission } from '@lokacia/contracts';
import { PageHeader } from '@/components/common/page-header';
import { IconTile, type Tone } from '@/components/common/ui';
import { useCrm } from '@/lib/crm-context';

const CARDS: { key: 'pipeline' | 'organization' | 'distribution' | 'profile' | 'sources'; href: string; icon: LucideIcon; tone: Tone; perm?: CrmPermission }[] = [
  { key: 'profile', href: '/settings/profile', icon: UserRound, tone: 2 },
  { key: 'pipeline', href: '/settings/pipeline', icon: GitBranch, tone: 1, perm: 'pipeline.manage' },
  { key: 'organization', href: '/settings/organization', icon: Building, tone: 4, perm: 'settings.manage' },
  { key: 'distribution', href: '/team#distribution', icon: Shuffle, tone: 7, perm: 'team.manage' },
  { key: 'sources', href: '/sources', icon: Target, tone: 5, perm: 'finance.view' },
];

export default function SettingsPage() {
  const t = useTranslations('team.settings');
  const { can } = useCrm();
  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CARDS.filter((c) => !c.perm || can(c.perm)).map((c) => (
          <li key={c.key}>
            <Link href={c.href} className="card card-hover group flex h-full flex-col gap-4 p-5 focus-visible:shadow-ring focus-visible:outline-none">
              <div className="flex items-start justify-between gap-3">
                <IconTile icon={c.icon} tone={c.tone} size="lg" />
                <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-muted transition-all duration-200 group-hover:bg-primary group-hover:text-primary-contrast" aria-hidden>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                </span>
              </div>
              <span className="min-w-0">
                <span className="block text-[17px] font-semibold leading-6">{t(c.key)}</span>
                <span className="mt-1 block text-[14px] leading-5 text-muted">{t(`${c.key}Hint`)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
