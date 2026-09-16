'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Building2, ExternalLink, HardHat, Trash2, UserPlus } from 'lucide-react';
import type { OrgRole, SessionUser } from '@lokacia/contracts';
import { Avatar, Badge, Button, Card, Dialog, Field, IconButton, Input, Select, Skeleton, Textarea, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';

type Org = { id: string; name: string; slug: string; type: 'agency' | 'developer'; phone: string | null; email: string | null; about: string | null; website: string | null; address: string | null; myRole: OrgRole | 'admin' };
type Member = { id: string; userId: string | null; role: OrgRole; invitedPhone: string | null; acceptedAt: string | null; active: boolean; name: string | null; phone: string | null; avatarUrl: string | null };
const ROLES: OrgRole[] = ['manager', 'agent', 'assistant'];

function errMsg(e: unknown, fallback: string) {
  return e instanceof ClientApiError ? e.message : fallback;
}

export function OrgManager({ user, crmUrl }: { user: SessionUser; crmUrl: string }) {
  const t = useTranslations('account.org');
  const [orgId, setOrgId] = React.useState(user.orgs[0]?.id ?? null);
  if (!user.orgs.length || !orgId) return <CreateOrg />;
  return (
    <div className="flex flex-col gap-6">
      {user.orgs.length > 1 && (
        <OrgSwitch orgs={user.orgs} value={orgId} onChange={setOrgId} />
      )}
      <OrgDetails key={orgId} orgId={orgId} userId={user.id} crmUrl={crmUrl} />
      <div className="border-t border-border pt-6">
        <details>
          <summary className="cursor-pointer text-link">+ {t('createTitle')}</summary>
          <div className="mt-4">
            <CreateOrg />
          </div>
        </details>
      </div>
    </div>
  );
}

function OrgSwitch({ orgs, value, onChange }: { orgs: SessionUser['orgs']; value: string; onChange: (id: string) => void }) {
  const t = useTranslations('account.org');
  return (
    <Field label={t('switch')} className="max-w-sm">
      <Select value={value} onChange={(e) => onChange(e.target.value)} options={orgs.map((o) => ({ value: o.id, label: `${o.name} · ${o.type === 'agency' ? t('typeAgency') : t('typeDeveloper')}` }))} />
    </Field>
  );
}

function CreateOrg() {
  const t = useTranslations('account.org');
  const toast = useToast();
  const router = useRouter();
  const [type, setType] = React.useState<'agency' | 'developer'>('agency');
  const [f, setF] = React.useState({ name: '', phone: '', email: '', about: '' });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await apiFetch('/orgs', { method: 'POST', body: { type, name: f.name.trim(), phone: f.phone.trim() || undefined, email: f.email.trim() || undefined, about: f.about.trim() || undefined } });
      toast({ title: t('created'), tone: 'success' });
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError && err.problem?.errors) setErrors(Object.fromEntries(err.problem.errors.map((x) => [x.path, x.message])));
      toast({ title: errMsg(err, t('error')), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="max-w-2xl p-5">
      <h2 className="text-h3 font-semibold">{t('createTitle')}</h2>
      <p className="mt-1 text-muted">{t('createIntro')}</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 text-small font-medium">{t('type')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['agency', 'developer'] as const).map((k) => {
              const Icon = k === 'agency' ? Building2 : HardHat;
              return (
                <label key={k} className={`flex cursor-pointer gap-3 rounded-card border p-3 ${type === k ? 'border-primary bg-primary/5' : 'border-border hover:border-border-strong'}`}>
                  <input type="radio" name="org-type" value={k} checked={type === k} onChange={() => setType(k)} className="sr-only" />
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
                  <span>
                    <span className="block font-medium">{k === 'agency' ? t('typeAgency') : t('typeDeveloper')}</span>
                    <span className="block text-small text-muted">{k === 'agency' ? t('typeAgencyHint') : t('typeDeveloperHint')}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <Field label={t('name')} required error={errors.name}>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={120} autoComplete="organization" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('phone')} error={errors.phone}>
            <Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" />
          </Field>
          <Field label={t('email')} error={errors.email}>
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
          </Field>
        </div>
        <Field label={t('about')} error={errors.about}>
          <Textarea value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} rows={3} maxLength={2000} />
        </Field>
        <div>
          <Button type="submit" loading={busy}>{t('create')}</Button>
        </div>
      </form>
    </Card>
  );
}

function OrgDetails({ orgId, userId, crmUrl }: { orgId: string; userId: string; crmUrl: string }) {
  const t = useTranslations('account.org');
  const tp = useTranslations('account.profile');
  const toast = useToast();
  const fetchOrg = <T,>(path: string) => apiFetch<T>(path, { orgId });
  const { data: org, mutate: mutateOrg } = useSWR<Org>(['/orgs/current', orgId], ([p]: [string]) => fetchOrg<Org>(p));
  const { data: members, mutate: mutateMembers } = useSWR<Member[]>(['/orgs/current/members', orgId], ([p]: [string]) => fetchOrg<Member[]>(p));
  const [form, setForm] = React.useState<Partial<Org>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [invite, setInvite] = React.useState({ phone: '', role: 'agent' as OrgRole });
  const [removing, setRemoving] = React.useState<Member | null>(null);
  React.useEffect(() => {
    if (org) setForm(org);
  }, [org]);
  if (!org) return <Skeleton className="h-64" />;
  const isManager = org.myRole === 'manager' || org.myRole === 'admin';

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('details');
    try {
      await apiFetch('/orgs/current', { method: 'PATCH', orgId, body: { name: form.name, phone: form.phone || undefined, email: form.email || undefined, about: form.about || undefined, address: form.address || null, website: form.website || null } });
      await mutateOrg();
      toast({ title: t('saved'), tone: 'success' });
    } catch (err) {
      toast({ title: errMsg(err, t('error')), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };
  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('invite');
    try {
      await apiFetch('/orgs/current/invites', { method: 'POST', orgId, body: invite });
      setInvite({ phone: '', role: 'agent' });
      await mutateMembers();
      toast({ title: t('invited'), tone: 'success' });
    } catch (err) {
      toast({ title: errMsg(err, t('error')), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };
  const changeRole = async (m: Member, role: OrgRole) => {
    try {
      await apiFetch(`/orgs/current/members/${m.id}`, { method: 'PATCH', orgId, body: { role } });
      await mutateMembers();
      toast({ title: t('roleChanged'), tone: 'success' });
    } catch (err) {
      toast({ title: errMsg(err, t('error')), tone: 'danger' });
    }
  };
  const remove = async () => {
    if (!removing) return;
    try {
      await apiFetch(`/orgs/current/members/${removing.id}`, { method: 'DELETE', orgId });
      await mutateMembers();
      toast({ title: t('removed'), tone: 'success' });
    } catch (err) {
      toast({ title: errMsg(err, t('error')), tone: 'danger' });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-h3 font-semibold">{org.name}</h2>
            <Badge tone="outline">{org.type === 'agency' ? t('typeAgency') : t('typeDeveloper')}</Badge>
          </div>
          {org.type === 'agency' && (
            <Button asChild size="sm" variant="secondary">
              <a href={crmUrl}>
                {t('openCrm')}
                <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
              </a>
            </Button>
          )}
        </div>
        <form onSubmit={saveDetails} className="flex flex-col gap-3">
          <fieldset disabled={!isManager} className="flex flex-col gap-3">
            <legend className="sr-only">{t('details')}</legend>
            <Field label={t('name')}>
              <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} minLength={2} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('phone')}>
                <Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label={t('email')}>
                <Input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
            </div>
            <Field label={t('address')}>
              <Input value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label={t('website')}>
              <Input type="url" value={form.website ?? ''} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" />
            </Field>
            <Field label={t('about')}>
              <Textarea value={form.about ?? ''} onChange={(e) => setForm({ ...form, about: e.target.value })} rows={3} />
            </Field>
          </fieldset>
          {isManager ? (
            <div>
              <Button type="submit" loading={busy === 'details'}>{t('saveDetails')}</Button>
            </div>
          ) : (
            <p className="text-small text-muted">{t('managerOnly')}</p>
          )}
        </form>
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-h3 font-semibold">{t('members')}</h2>
          <span className="text-small text-muted">{t('membersCount', { count: members?.length ?? 0 })}</span>
        </div>
        {isManager && (
          <form onSubmit={sendInvite} className="grid gap-3 border-b border-border px-5 py-4 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
            <Field label={t('invitePhone')}>
              <Input type="tel" inputMode="tel" required value={invite.phone} onChange={(e) => setInvite({ ...invite, phone: e.target.value })} placeholder={t('invitePhonePlaceholder')} />
            </Field>
            <Field label={t('inviteRole')}>
              <Select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as OrgRole })} options={ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))} />
            </Field>
            <Button type="submit" loading={busy === 'invite'}>
              <UserPlus className="size-4" strokeWidth={1.5} aria-hidden />
              {t('inviteSend')}
            </Button>
          </form>
        )}
        {!members ? (
          <Skeleton className="m-5 h-24" />
        ) : (
          <ul>
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 last:border-b-0">
                <Avatar src={m.avatarUrl} name={m.name ?? m.invitedPhone} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {m.name ?? m.invitedPhone ?? '—'} {m.userId === userId && <span className="text-small text-muted">({t('you')})</span>}
                  </div>
                  <div className="text-small text-muted tabular">{m.phone ?? m.invitedPhone}</div>
                  {!m.userId && <Badge tone="accent" className="mt-1">{t('pending')}</Badge>}
                </div>
                {isManager && m.userId !== userId ? (
                  <div className="flex items-center gap-1">
                    <Select aria-label={t('changeRole')} value={m.role} onChange={(e) => void changeRole(m, e.target.value as OrgRole)} options={ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))} className="h-8 w-36 text-small" />
                    <IconButton label={t('remove')} size="sm" onClick={() => setRemoving(m)}>
                      <Trash2 className="size-4 text-danger" strokeWidth={1.5} />
                    </IconButton>
                  </div>
                ) : (
                  <Badge tone="outline">{t(`roles.${m.role}`)}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Dialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        size="sm"
        title={t('remove')}
        description={removing ? t('removeConfirm', { name: removing.name ?? removing.invitedPhone ?? '' }) : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>{tp('cancel')}</Button>
            <Button variant="danger" onClick={() => void remove()}>{t('remove')}</Button>
          </>
        }
      />
    </div>
  );
}
