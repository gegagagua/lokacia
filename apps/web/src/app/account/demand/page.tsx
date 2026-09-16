import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { redirect } from 'next/navigation';
import { getAppLocale } from '@/i18n/server';
import { localizePath } from '@/i18n/locale';
import { getTranslations } from 'next-intl/server';
import { Megaphone, Plus } from 'lucide-react';
import type { DemandDto } from '@lokacia/contracts';
import { Button } from '@lokacia/ui';
import { AccountPageHeader } from '@/components/account/page-header';
import { AccountEmpty } from '@/components/account/ui';
import { api } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import { getNames } from '@/components/portal/data';
import { DemandCard } from '@/components/portal/demand/demand-card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: t('myDemand'), robots: { index: false, follow: false } };
}

export default async function MyDemandPage() {
  const user = await getSession();
  if (!user) redirect(localizePath('/login?next=/account/demand', await getAppLocale()));
  const t = await getTranslations('demand');
  const [items, { types }] = await Promise.all([api<DemandDto[]>('/v1/demand/mine').catch(() => [] as DemandDto[]), getNames()]);
  const icons = Object.fromEntries(types.map((x) => [x.slug, x.icon]));
  return (
    <div>
      <AccountPageHeader
        title={t('account.title')}
        actions={
          <Button asChild>
            <Link href="/demand/new">
              <Plus className="size-4" strokeWidth={2.25} aria-hidden />
              {t('board.add')}
            </Link>
          </Button>
        }
      />
      {items.length === 0 ? (
        <AccountEmpty
          icon={Megaphone}
          title={t('account.empty')}
          description={t('account.emptyHint')}
          action={
            <Button asChild>
              <Link href="/demand/new">
                <Plus className="size-4" strokeWidth={2.25} aria-hidden />
                {t('board.add')}
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((d) => (
            <li key={d.id} className="[&>*]:h-full">
              <DemandCard d={d} icon={icons[d.businessType]} showStatus />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
