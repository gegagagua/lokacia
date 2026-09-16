'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Ban, Building2, CreditCard, History, LayoutList, LogIn, ShieldCheck, UserRound } from 'lucide-react';
import { LISTING_STATUS_LABELS_KA, ROLES, SUBSCRIPTION_STATUS_LABELS_KA, formatDateKa, formatDateTimeKa, type AdminUserDetail, type Role } from '@lokacia/contracts';
import { Avatar, Button, Dialog, Field, Select, cn } from '@lokacia/ui';
import { InlineEmpty, KeyValues, StatusPill } from '@/components/kit';
import { roleTone } from './users';
import { OrgMark } from './orgs';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { useIsAdmin, useSessionUser } from '@/lib/session-context';
import { BackLink, Section } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { ReasonDialog } from '@/components/reason-dialog';
import { AuditTable } from './audit';

export function UserDetailView({ id }: { id: string }) {
  const t = useTranslations('users');
  const tr = useTranslations('nav.role');
  const isAdmin = useIsAdmin();
  const me = useSessionUser();
  const { data: u, error, mutate } = useSWR<AdminUserDetail>(`/admin/users/${id}`, fetcher);
  const [role, setRole] = React.useState<Role | ''>('');
  const [banOpen, setBanOpen] = React.useState(false);
  const [impOpen, setImpOpen] = React.useState(false);
  const { run, busy } = useAction();
  React.useEffect(() => {
    if (u) setRole(u.role);
  }, [u]);
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!u) return <LoadingBlock rows={10} />;
  const self = me?.id === u.id;

  const saveRole = async () => {
    if (!role || role === u.role) return;
    if (await run(() => apiFetch(`/admin/users/${u.id}/role`, { method: 'PATCH', body: { role } }), t('roleSaved'))) await mutate();
  };
  const ban = async (reason: string) => {
    if (await run(() => apiFetch(`/admin/users/${u.id}/ban`, { method: 'POST', body: { reason } }), t('bannedDone'))) {
      setBanOpen(false);
      await mutate();
    }
  };
  const unban = async () => {
    if (await run(() => apiFetch(`/admin/users/${u.id}/unban`, { method: 'POST' }), t('unbannedDone'))) await mutate();
  };
  const impersonate = async () => {
    const r = await run(() => apiFetch<{ ok: boolean; redirectUrl: string }>(`/admin/users/${u.id}/impersonate`, { method: 'POST' }));
    if (r?.redirectUrl) window.location.href = r.redirectUrl;
  };

  return (
    <>
      <BackLink href="/users" label={t('title')} />

      <section className="card mb-5 overflow-hidden">
        <div className="relative h-24 bg-gradient-to-r from-primary-soft via-surface-2 to-accent-soft sm:h-28" aria-hidden>
          <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(var(--border-strong)_1px,transparent_1px)] [background-size:18px_18px]" />
        </div>
        <div className="flex flex-wrap items-end gap-4 px-5 pb-5 md:px-6">
          <Avatar name={u.name ?? u.phone} size={88} className="-mt-11 shadow-md ring-4 ring-surface" />
          <div className="min-w-0 flex-1 basis-56 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">{u.name ?? t('noName')}</h1>
              <StatusPill tone={roleTone(u.role)} dot={false}>
                {tr(u.role)}
              </StatusPill>
              {u.bannedAt ? <StatusPill tone="danger">{t('banned')}</StatusPill> : <StatusPill tone="success">{t('active')}</StatusPill>}
              {u.verifiedAt && (
                <StatusPill tone="info" dot={false}>
                  <ShieldCheck className="size-3.5" strokeWidth={2} aria-hidden />
                  {t('verified')}
                </StatusPill>
              )}
            </div>
            <div className="mt-1 text-small text-muted tabular">{[u.phone, u.email].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && !self && !u.bannedAt && (
              <Button size="sm" variant="secondary" icon={<LogIn className="size-4" strokeWidth={2} aria-hidden />} onClick={() => setImpOpen(true)}>
                {t('impersonate')}
              </Button>
            )}
            {!self &&
              (u.bannedAt ? (
                <Button size="sm" variant="secondary" loading={busy} icon={<ShieldCheck className="size-4" strokeWidth={2} aria-hidden />} onClick={unban}>
                  {t('unban')}
                </Button>
              ) : (
                <Button size="sm" variant="danger" icon={<Ban className="size-4" strokeWidth={2} aria-hidden />} onClick={() => setBanOpen(true)}>
                  {t('ban')}
                </Button>
              ))}
          </div>
        </div>
        <dl className="grid grid-cols-2 border-t border-border md:grid-cols-4">
          {[
            { label: t('colListings'), value: u.listingsCount },
            { label: t('sessions'), value: u.activeSessions },
            { label: t('colCreated'), value: formatDateKa(u.createdAt) },
            { label: t('colSeen'), value: u.lastSeenAt ? formatDateTimeKa(u.lastSeenAt) : '—' },
          ].map((x, i) => (
            <div key={x.label} className={cn('min-w-0 px-5 py-4 md:px-6', i % 2 === 1 && 'border-l border-border', i >= 2 && 'border-t border-border md:border-t-0', i === 2 && 'md:border-l')}>
              <dt className="text-[13px] font-medium text-muted">{x.label}</dt>
              <dd className="mt-0.5 truncate text-[17px] font-bold tabular">{x.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {u.bannedAt && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[15px]" role="status">
          <Ban className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={2} aria-hidden />
          <span>{t('banInfo', { date: formatDateTimeKa(u.bannedAt), reason: u.banReason ?? '—' })}</span>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <Section icon={UserRound} title={t('profile')}>
          <KeyValues
            cols={2}
            items={[
              { label: t('role'), value: tr(u.role), wide: true },
              { label: t('verified'), value: u.verifiedAt ? formatDateKa(u.verifiedAt) : '—', wide: true },
            ]}
          />
          {isAdmin && !self && (
            <div className="mt-5 rounded-2xl border border-dashed border-border-strong p-4">
              <Field label={t('changeRole')}>
                <Select value={role} onChange={(e) => setRole(e.target.value as Role)} options={ROLES.filter((r) => r !== 'guest').map((r) => ({ value: r, label: tr(r) }))} />
              </Field>
              <Button className="mt-3 w-full" loading={busy} disabled={role === u.role} onClick={saveRole}>
                {t('saveRole')}
              </Button>
            </div>
          )}
        </Section>
        <Section icon={Building2} title={t('orgs')}>
          {u.orgs.length ? (
            <ul className="flex flex-col gap-2">
              {u.orgs.map((o) => (
                <li key={o.id}>
                  <Link href={`/orgs/${o.id}`} className="flex items-center gap-3 rounded-2xl bg-surface-2/70 px-3 py-2.5 transition-colors hover:bg-surface-3">
                    <OrgMark name={o.name} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{o.name}</span>
                    <span className="text-small text-muted">{t(`orgRole.${o.role}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <InlineEmpty icon={Building2}>{t('noOrgs')}</InlineEmpty>
          )}
          <h3 className="mb-2 mt-5 flex items-center gap-2 text-[15px] font-bold">
            <CreditCard className="size-4 text-muted" strokeWidth={2} aria-hidden />
            {t('subscriptions')}
          </h3>
          {u.subscriptions.length ? (
            <ul className="flex flex-col gap-2">
              {u.subscriptions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border px-3 py-2.5">
                  <span className="rounded-lg bg-accent-soft px-2 py-0.5 font-mono text-[13px] font-semibold text-[#7a5500] dark:text-accent">{s.planKey}</span>
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
        <Section icon={LayoutList} title={t('listings')} flush>
          {u.listings.length ? (
            <ul className="max-h-96 overflow-y-auto px-3 pb-3">
              {u.listings.map((l) => (
                <li key={l.id}>
                  <Link href={`/moderation/${l.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2">
                    <span className="min-w-0 truncate text-[14.5px] font-medium">{l.title}</span>
                    <StatusPill tone={l.status === 'active' ? 'success' : l.status === 'pending_review' ? 'accent' : l.status === 'rejected' ? 'danger' : 'neutral'}>{LISTING_STATUS_LABELS_KA[l.status]}</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 pb-5 md:px-6">
              <InlineEmpty icon={LayoutList}>{t('noListings')}</InlineEmpty>
            </div>
          )}
        </Section>
      </div>
      <Section icon={History} title={t('audit')} className="mt-5">
        <AuditTable items={u.audit} />
      </Section>

      <ReasonDialog open={banOpen} onOpenChange={setBanOpen} title={t('banTitle')} description={t('banDescription')} confirmLabel={t('ban')} busy={busy} onConfirm={ban} templates={false} />
      <Dialog
        open={impOpen}
        onOpenChange={setImpOpen}
        title={t('impersonateTitle')}
        description={u.name ?? u.phone ?? ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setImpOpen(false)}>
              {t('cancel')}
            </Button>
            <Button loading={busy} onClick={impersonate}>
              {t('impersonate')}
            </Button>
          </>
        }
      >
        <p className="text-[15px]">{t('impersonateText')}</p>
      </Dialog>
    </>
  );
}
