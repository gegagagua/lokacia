'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Ban, LogIn, ShieldCheck } from 'lucide-react';
import { LISTING_STATUS_LABELS_KA, ROLES, SUBSCRIPTION_STATUS_LABELS_KA, formatDateKa, formatDateTimeKa, type AdminUserDetail, type Role } from '@lokacia/contracts';
import { Avatar, Badge, Button, Dialog, Field, Select, SpecRow } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { useIsAdmin, useSessionUser } from '@/lib/session-context';
import { PageHeader, Section } from '@/components/page-header';
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
      <PageHeader
        back={{ href: '/users', label: t('title') }}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={u.name ?? u.phone} size={36} />
            {u.name ?? t('noName')}
          </span>
        }
        subtitle={[u.phone, u.email].filter(Boolean).join(' · ')}
        actions={
          <>
            {u.bannedAt ? <Badge tone="danger">{t('banned')}</Badge> : <Badge tone="success">{t('active')}</Badge>}
            {!self &&
              (u.bannedAt ? (
                <Button size="sm" variant="secondary" loading={busy} icon={<ShieldCheck className="size-4" strokeWidth={1.5} aria-hidden />} onClick={unban}>
                  {t('unban')}
                </Button>
              ) : (
                <Button size="sm" variant="danger" icon={<Ban className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => setBanOpen(true)}>
                  {t('ban')}
                </Button>
              ))}
            {isAdmin && !self && !u.bannedAt && (
              <Button size="sm" variant="secondary" icon={<LogIn className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => setImpOpen(true)}>
                {t('impersonate')}
              </Button>
            )}
          </>
        }
      />
      {u.bannedAt && (
        <p className="mb-4 rounded-card border border-danger px-4 py-2 text-small" role="status">
          {t('banInfo', { date: formatDateTimeKa(u.bannedAt), reason: u.banReason ?? '—' })}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title={t('profile')}>
          <SpecRow label={t('role')} value={tr(u.role)} />
          <SpecRow label={t('colCreated')} value={formatDateKa(u.createdAt)} />
          <SpecRow label={t('colSeen')} value={u.lastSeenAt ? formatDateTimeKa(u.lastSeenAt) : '—'} />
          <SpecRow label={t('verified')} value={u.verifiedAt ? formatDateKa(u.verifiedAt) : '—'} />
          <SpecRow label={t('sessions')} value={u.activeSessions} />
          <SpecRow label={t('colListings')} value={u.listingsCount} />
          {isAdmin && !self && (
            <div className="mt-4 flex items-end gap-2">
              <Field label={t('changeRole')} className="flex-1">
                <Select value={role} onChange={(e) => setRole(e.target.value as Role)} options={ROLES.filter((r) => r !== 'guest').map((r) => ({ value: r, label: tr(r) }))} />
              </Field>
              <Button size="md" loading={busy} disabled={role === u.role} onClick={saveRole}>
                {t('saveRole')}
              </Button>
            </div>
          )}
        </Section>
        <Section title={t('orgs')}>
          {u.orgs.length ? (
            <ul>
              {u.orgs.map((o) => (
                <li key={o.id} className="flex justify-between border-b border-border py-1.5 text-[14px] last:border-b-0">
                  <Link href={`/orgs/${o.id}`} className="text-link hover:underline">
                    {o.name}
                  </Link>
                  <span className="text-muted">{t(`orgRole.${o.role}`)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-muted">{t('noOrgs')}</p>
          )}
          <h3 className="mb-1 mt-4 text-small font-medium">{t('subscriptions')}</h3>
          {u.subscriptions.length ? (
            <ul>
              {u.subscriptions.map((s) => (
                <li key={s.id} className="flex justify-between border-b border-border py-1.5 text-[14px] last:border-b-0">
                  <span className="font-mono text-[13px]">{s.planKey}</span>
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
        <Section title={t('listings')}>
          {u.listings.length ? (
            <ul className="max-h-80 overflow-y-auto">
              {u.listings.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 border-b border-border py-1.5 text-[14px] last:border-b-0">
                  <Link href={`/moderation/${l.id}`} className="truncate text-link hover:underline">
                    {l.title}
                  </Link>
                  <Badge tone={l.status === 'active' ? 'success' : l.status === 'pending_review' ? 'accent' : 'neutral'}>{LISTING_STATUS_LABELS_KA[l.status]}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-muted">{t('noListings')}</p>
          )}
        </Section>
      </div>
      <Section title={t('audit')} className="mt-4">
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
