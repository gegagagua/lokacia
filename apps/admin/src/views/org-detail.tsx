'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { SUBSCRIPTION_STATUS_LABELS_KA, formatDateKa, type AdminOrgDetail, type PlansResponse } from '@lokacia/contracts';
import { Badge, Button, Field, Select, SpecRow, Switch } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { useIsAdmin } from '@/lib/session-context';
import { PageHeader, Section } from '@/components/page-header';
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
      <PageHeader back={{ href: '/orgs', label: t('title') }} title={o.name} subtitle={`${t(`types.${o.type}`)} · ${o.slug}`} actions={o.verified ? <Badge tone="success">{t('verified')}</Badge> : undefined} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title={t('info')}>
          <SpecRow label={t('phone')} value={o.phone ?? '—'} />
          <SpecRow label={t('email')} value={o.email ?? '—'} />
          <SpecRow label={t('colCreated')} value={formatDateKa(o.createdAt)} />
          <SpecRow label={t('colMembers')} value={o.membersCount} />
          <SpecRow label={t('colListings')} value={o.listingsCount} />
          <SpecRow label={t('plan')} value={<span className="font-mono text-[13px]">{o.plan}</span>} />
          {isAdmin && (
            <div className="mt-4 flex flex-col gap-4">
              <Switch label={t('verifiedToggle')} checked={o.verified} disabled={busy} onCheckedChange={(v) => patch({ verified: v })} />
              <div className="flex items-end gap-2">
                <Field label={t('plan')} className="flex-1">
                  <Select value={plan} onChange={(e) => setPlan(e.target.value)} options={planOptions} />
                </Field>
                <Button loading={busy} disabled={plan === o.plan} onClick={() => patch({ plan })}>
                  {t('savePlan')}
                </Button>
              </div>
            </div>
          )}
        </Section>
        <Section title={t('members')} className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-[14px] tabular">
              <thead>
                <tr className="border-b border-border-strong text-small text-muted">
                  <th scope="col" className="px-2 py-1.5 font-medium">{t('member')}</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">{t('role')}</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">{t('state')}</th>
                </tr>
              </thead>
              <tbody>
                {o.members.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-b-0">
                    <td className="px-2 py-1.5">
                      {m.userId ? (
                        <Link href={`/users/${m.userId}`} className="text-link hover:underline">
                          {m.name ?? m.phone}
                        </Link>
                      ) : (
                        <span>
                          {m.phone} <span className="text-small text-muted">({t('invited')})</span>
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">{t(`roles.${m.role}`)}</td>
                    <td className="px-2 py-1.5">{m.active ? <Badge tone="success">{t('activeMember')}</Badge> : <Badge>{t('inactiveMember')}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="mb-1 mt-5 text-small font-medium">{t('subscriptions')}</h3>
          {o.subscriptions.length ? (
            <ul>
              {o.subscriptions.map((s) => (
                <li key={s.id} className="flex justify-between border-b border-border py-1.5 text-[14px] last:border-b-0">
                  <span className="font-mono text-[13px]">
                    {s.planKey} × {s.seats}
                  </span>
                  <span className="text-muted">
                    {SUBSCRIPTION_STATUS_LABELS_KA[s.status as keyof typeof SUBSCRIPTION_STATUS_LABELS_KA] ?? s.status}
                    {s.periodEnd ? ` · ${formatDateKa(s.periodEnd)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-muted">{t('noSubscriptions')}</p>
          )}
        </Section>
      </div>
    </>
  );
}
