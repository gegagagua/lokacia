'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { SUBSCRIPTION_STATUS_LABELS_KA, formatDateKa, type AdminOrgDetail, type PlansResponse } from '@lokacia/contracts';
import { BadgeCheck, CreditCard, Info, Users } from 'lucide-react';
import { Button, Field, Select, Switch, cn } from '@lokacia/ui';
import { InlineEmpty, KeyValues, Person, StatusPill, TableCard, THead, td, th, tr } from '@/components/kit';
import { OrgMark } from './orgs';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { useIsAdmin } from '@/lib/session-context';
import { BackLink, Section } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';

export function OrgDetailView({ id }: { id: string }) {
  const t = useTranslations('orgs');
  const isAdmin = useIsAdmin();
  const { data: o, error, mutate } = useSWR<AdminOrgDetail>(`/admin/orgs/${id}`, fetcher);
  const { data: plans } = useSWR<PlansResponse>(isAdmin ? '/billing/plans' : null, fetcher);
  const [plan, setPlan] = React.useState('');
  const { run, busy } = useAction();
  React.useEffect(() => {
    if (o) setPlan(o.plan);
  }, [o]);
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!o) return <LoadingBlock rows={8} />;
  const patch = async (body: { verified?: boolean; plan?: string }) => {
    if (await run(() => apiFetch(`/admin/orgs/${o.id}`, { method: 'PATCH', body }), t('saved'))) await mutate();
  };
  const planOptions = [{ value: 'free', label: t('freePlan') }, ...(plans?.plans ?? []).filter((p) => p.kind === 'subscription').map((p) => ({ value: p.key, label: p.nameKa }))];
  if (!planOptions.some((p) => p.value === o.plan)) planOptions.push({ value: o.plan, label: o.plan });
  return (
    <>
      <BackLink href="/orgs" label={t('title')} />
      <section className="card mb-5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 p-5 md:p-6">
          <OrgMark name={o.name} size="lg" />
          <div className="min-w-0 flex-1 basis-56">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">{o.name}</h1>
              {o.verified && (
                <StatusPill tone="info" dot={false}>
                  <BadgeCheck className="size-3.5" strokeWidth={2} aria-hidden />
                  {t('verified')}
                </StatusPill>
              )}
              <StatusPill tone={o.type === 'agency' ? 'info' : 'primary'} dot={false}>
                {t(`types.${o.type}`)}
              </StatusPill>
            </div>
            <div className="mt-1 font-mono text-[13px] text-muted">{o.slug}</div>
          </div>
          <span className={cn('rounded-xl px-3 py-1.5 font-mono text-[14px] font-semibold', o.plan === 'free' ? 'bg-surface-2 text-muted' : 'bg-accent-soft text-[#7a5500] dark:text-accent')}>{o.plan}</span>
        </div>
        <dl className="grid grid-cols-2 border-t border-border md:grid-cols-4">
          {[
            { label: t('colMembers'), value: o.membersCount },
            { label: t('colListings'), value: o.listingsCount },
            { label: t('phone'), value: o.phone ?? '—' },
            { label: t('colCreated'), value: formatDateKa(o.createdAt) },
          ].map((x, i) => (
            <div key={x.label} className={cn('min-w-0 px-5 py-4 md:px-6', i % 2 === 1 && 'border-l border-border', i >= 2 && 'border-t border-border md:border-t-0', i === 2 && 'md:border-l')}>
              <dt className="text-[13px] font-medium text-muted">{x.label}</dt>
              <dd className="mt-0.5 truncate text-[17px] font-bold tabular">{x.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <Section icon={Info} title={t('info')}>
          <KeyValues
            cols={2}
            items={[
              { label: t('email'), value: o.email ?? '—', wide: true },
              { label: t('plan'), value: <span className="font-mono">{o.plan}</span>, wide: true },
            ]}
          />
          {isAdmin && (
            <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-dashed border-border-strong p-4">
              <Switch label={t('verifiedToggle')} checked={o.verified} disabled={busy} onCheckedChange={(v) => patch({ verified: v })} />
              <Field label={t('plan')}>
                <Select value={plan} onChange={(e) => setPlan(e.target.value)} options={planOptions} />
              </Field>
              <Button loading={busy} disabled={plan === o.plan} onClick={() => patch({ plan })}>
                {t('savePlan')}
              </Button>
            </div>
          )}
        </Section>
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <Section icon={Users} title={t('members')} description={t('membersCount', { count: o.members.length })} flush>
            <TableCard flat minWidth={480}>
              <THead>
                <th scope="col" className={th}>{t('member')}</th>
                <th scope="col" className={th}>{t('role')}</th>
                <th scope="col" className={th}>{t('state')}</th>
              </THead>
              <tbody>
                {o.members.map((m) => (
                  <tr key={m.id} className={tr}>
                    <td className={td}>
                      {m.userId ? (
                        <Person name={m.name ?? m.phone} href={`/users/${m.userId}`} sub={m.name ? m.phone : undefined} size={32} />
                      ) : (
                        <Person name={m.phone} sub={t('invited')} size={32} />
                      )}
                    </td>
                    <td className={td}>{t(`roles.${m.role}`)}</td>
                    <td className={td}>{m.active ? <StatusPill tone="success">{t('activeMember')}</StatusPill> : <StatusPill>{t('inactiveMember')}</StatusPill>}</td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          </Section>
          <Section icon={CreditCard} title={t('subscriptions')}>
            {o.subscriptions.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {o.subscriptions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border px-4 py-3">
                    <span className="font-mono text-[14px] font-semibold">
                      {s.planKey} <span className="text-muted">× {s.seats}</span>
                    </span>
                    <span className="text-small text-muted">
                      {SUBSCRIPTION_STATUS_LABELS_KA[s.status as keyof typeof SUBSCRIPTION_STATUS_LABELS_KA] ?? s.status}
                      {s.periodEnd ? ` · ${formatDateKa(s.periodEnd)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <InlineEmpty icon={CreditCard}>{t('noSubscriptions')}</InlineEmpty>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
