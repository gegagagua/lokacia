import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Plus } from 'lucide-react';
import type { DemandDto } from '@lokacia/contracts';
import { Button, EmptyState } from '@lokacia/ui';
import { api } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import { getNames } from '@/components/portal/data';
import { DemandCard } from '@/components/portal/demand/demand-card';

export const metadata: Metadata = { title: 'ჩემი მოთხოვნები', robots: { index: false, follow: false } };

export default async function MyDemandPage() {
  const user = await getSession();
  if (!user) redirect('/login?next=/account/demand');
  const t = await getTranslations('demand');
  const [items, { types }] = await Promise.all([api<DemandDto[]>('/v1/demand/mine').catch(() => [] as DemandDto[]), getNames()]);
  const icons = Object.fromEntries(types.map((x) => [x.slug, x.icon]));
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-h2 font-semibold md:text-h1">{t('account.title')}</h1>
        <Button asChild>
          <Link href="/demand/new">
            <Plus className="size-4" strokeWidth={1.5} aria-hidden />
            {t('board.add')}
          </Link>
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          className="mt-6"
          title={t('account.empty')}
          description={t('account.emptyHint')}
          action={
            <Button asChild>
              <Link href="/demand/new">{t('board.add')}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {items.map((d) => (
            <li key={d.id}>
              <DemandCard d={d} icon={icons[d.businessType]} showStatus />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
