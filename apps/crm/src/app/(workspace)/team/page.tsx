'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { AlarmClock, Check, Contact, KeyRound, MapPin, Minus, Phone, SquareKanban, Trophy, UserPlus, Users } from 'lucide-react';
import { CRM_PERMISSIONS, CRM_ROLE_PERMISSIONS, ORG_ROLES, type LeadDistributionMode, type TeamMemberStats } from '@lokacia/contracts';
import { Button, cn, Field, Input, Select, Skeleton, Switch, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { ChipGroup, EmptyHint, PersonAvatar, Pill, SectionCard, StatCard, type Tone } from '@/components/common/ui';
import { DistributionSettings } from '@/components/team/distribution-settings';
import { DistrictsDialog, useDistricts } from '@/components/team/districts-dialog';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';

const ROLE_TONE: Record<string, Tone> = { manager: 1, agent: 2, assistant: 4 };

export default function TeamPage() {
  const t = useTranslations('team');
  const roles = useTranslations('shell.roles');
  const toast = useToast();
  const mutateApi = useApiMutation();
  const { can, user } = useCrm();
  const manage = can('team.manage');
  const { data, mutate } = useApi<{ leadDistribution: LeadDistributionMode; members: TeamMemberStats[] }>('/crm/team');
  const { data: districts = [] } = useDistricts();
  const [editing, setEditing] = React.useState<TeamMemberStats | null>(null);
  const [phone, setPhone] = React.useState('');
  const [role, setRole] = React.useState('agent');
  const [busy, setBusy] = React.useState(false);
  const [filter, setFilter] = React.useState<'all' | (typeof ORG_ROLES)[number]>('all');

  const update = async (m: TeamMemberStats, body: Record<string, unknown>) => {
    try {
      await mutateApi(`/crm/team/members/${m.id}`, { method: 'PATCH', body });
      toast({ title: t('saved'), tone: 'success' });
      await mutate();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    }
  };
  const districtName = (id: string) => districts.find((d) => d.id === id)?.nameKa ?? '';
  const members = (data?.members ?? []).slice().sort((a, b) => Number(b.active) - Number(a.active) || b.stats.openDeals - a.stats.openDeals);
  const shown = filter === 'all' ? members : members.filter((m) => m.role === filter);
  const sum = members.reduce((a, m) => ({ contacts: a.contacts + m.stats.contacts, open: a.open + m.stats.openDeals, won: a.won + m.stats.wonThisMonth, overdue: a.overdue + m.stats.overdueTasks }), { contacts: 0, open: 0, won: 0, overdue: 0 });

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader title={t('title')} subtitle={t('subtitle')} className="mb-1" meta={data ? <Pill icon={Users} tone={1}>{t('membersCount', { count: members.length })}</Pill> : undefined} />

      {data && (
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <StatCard label={t('stats.contacts')} value={sum.contacts} icon={Contact} tone={2} />
          <StatCard label={t('stats.openDeals')} value={sum.open} icon={SquareKanban} tone={6} />
          <StatCard label={t('stats.wonThisMonth')} value={sum.won} icon={Trophy} tone="success" />
          <StatCard label={t('stats.overdueTasks')} value={sum.overdue} icon={AlarmClock} tone="danger" />
        </div>
      )}

      <SectionCard
        icon={Users}
        tone={1}
        title={t('members')}
        description={t('membersHint')}
      >
        <div className="mb-4">
          <ChipGroup
            label={t('role')}
            value={filter}
            onChange={setFilter}
            options={[{ value: 'all' as const, label: t('allRoles'), count: members.length }, ...ORG_ROLES.map((r) => ({ value: r, label: roles(r), count: members.filter((m) => m.role === r).length }))]}
          />
        </div>
        {!data ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-64 rounded-card" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyHint icon={Users} title={t('noMembers')} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((m) => {
              const self = m.userId === user.id;
              const tone = ROLE_TONE[m.role] ?? 8;
              return (
                <li key={m.id} className={cn('card card-hover relative flex flex-col overflow-hidden p-0', !m.active && 'opacity-70')}>
                  <div aria-hidden className={cn('h-14 bg-tone-soft', `tone-${tone}`)} />
                  <div className="-mt-8 flex flex-col gap-4 px-4 pb-4">
                    <div className="flex items-end justify-between gap-3">
                      <span className="rounded-full bg-surface shadow-sm ring-4 ring-surface">
                        <PersonAvatar src={m.avatarUrl} name={m.name ?? m.invitedPhone} size={60} />
                      </span>
                      <Switch aria-label={`${t('active')}: ${m.name ?? m.invitedPhone ?? ''}`} checked={m.active} disabled={!manage || self} onCheckedChange={(v) => update(m, { active: v })} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-[16px] font-semibold">{m.name ?? m.invitedPhone}</h3>
                        {self && <Pill size="sm" tone="neutral">{t('you')}</Pill>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted tabular">
                        {m.userId ? (
                          <>
                            <Phone className="size-3.5" strokeWidth={2} aria-hidden />
                            {m.phone}
                          </>
                        ) : (
                          <Pill size="sm" tone={3} dot>
                            {t('invited')}
                          </Pill>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {manage && !self ? (
                        <Select aria-label={`${t('role')}: ${m.name ?? m.invitedPhone ?? ''}`} value={m.role} onChange={(e) => update(m, { role: e.target.value })} options={ORG_ROLES.map((r) => ({ value: r, label: roles(r) }))} className="h-9 w-40 rounded-full text-[14px]" />
                      ) : (
                        <Pill tone={tone} dot>
                          {roles(m.role)}
                        </Pill>
                      )}
                      {!m.active && <Pill tone="neutral">{t('inactive')}</Pill>}
                    </div>
                    <dl className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-2 text-center">
                      {([
                        ['contacts', m.stats.contacts, ''],
                        ['openDeals', m.stats.openDeals, ''],
                        ['wonThisMonth', m.stats.wonThisMonth, 'text-success'],
                        ['overdueTasks', m.stats.overdueTasks, m.stats.overdueTasks ? 'text-danger' : ''],
                      ] as const).map(([k, v, cls]) => (
                        <div key={k} className="flex min-w-0 flex-col-reverse" title={t(`stats.${k}`)}>
                          <dt className="truncate text-[11.5px] leading-4 text-muted">{t(`statsShort.${k}`)}</dt>
                          <dd className={cn('text-[18px] font-bold leading-6 tabular', cls)}>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <button
                      type="button"
                      disabled={!manage}
                      onClick={() => setEditing(m)}
                      className="group flex min-h-9 items-center gap-2 rounded-xl border border-dashed border-border-strong px-3 py-1.5 text-left text-[13px] transition-colors enabled:hover:border-primary enabled:hover:bg-primary-soft/40 disabled:cursor-default disabled:border-solid disabled:border-border"
                      aria-label={`${t('editDistricts')}: ${m.name ?? m.invitedPhone ?? ''}`}
                    >
                      <MapPin className="size-4 shrink-0 text-muted group-enabled:group-hover:text-primary" strokeWidth={2} aria-hidden />
                      <span className="line-clamp-2 min-w-0 flex-1">{m.districtIds.length ? m.districtIds.map(districtName).join(', ') : <span className="text-muted">{t('noDistricts')}</span>}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {data && <DistributionSettings value={data.leadDistribution} />}
        {manage && (
          <SectionCard icon={UserPlus} tone={5} title={t('invite.title')} description={t('invite.hint')}>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await mutateApi('/orgs/current/invites', { body: { phone, role } });
                  toast({ title: t('invite.sent'), tone: 'success' });
                  setPhone('');
                  await mutate();
                } catch (err) {
                  toast({ title: errorMessage(err), tone: 'danger' });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label={t('invite.phone')} required>
                <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} prefixIcon={<span className="text-small">+995</span>} required />
              </Field>
              <Field label={t('invite.role')}>
                <Select value={role} onChange={(e) => setRole(e.target.value)} options={ORG_ROLES.map((r) => ({ value: r, label: roles(r) }))} />
              </Field>
              <Button type="submit" loading={busy} icon={<UserPlus className="size-4" strokeWidth={2} />}>
                {t('invite.submit')}
              </Button>
            </form>
          </SectionCard>
        )}
      </div>

      <SectionCard icon={KeyRound} tone={3} title={t('permissions.title')} description={t('permissions.hint')} bodyClassName="p-2 md:p-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[14px] tabular">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th scope="col" className="rounded-l-xl bg-surface-2 px-3 py-2.5 font-semibold">
                  {t('permissions.permission')}
                </th>
                {ORG_ROLES.map((r, i) => (
                  <th key={r} scope="col" className={cn('bg-surface-2 px-3 py-2.5 text-center font-semibold', i === ORG_ROLES.length - 1 && 'rounded-r-xl')}>
                    <Pill size="sm" tone={ROLE_TONE[r] ?? 8}>
                      {roles(r)}
                    </Pill>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CRM_PERMISSIONS.map((p) => (
                <tr key={p} className="border-b border-border transition-colors last:border-b-0 hover:bg-surface-2/60">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    {t(`permissions.list.${p.replace('.', '_')}`)}
                  </th>
                  {ORG_ROLES.map((r) => (
                    <td key={r} className="px-3 py-2 text-center">
                      {CRM_ROLE_PERMISSIONS[r].includes(p) ? (
                        <span className="mx-auto grid size-6 place-items-center rounded-full bg-success/12 text-success">
                          <Check className="size-3.5" strokeWidth={3} aria-label="✓" />
                        </span>
                      ) : (
                        <Minus className="mx-auto size-4 text-border-strong" strokeWidth={2} aria-label="—" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      {editing && <DistrictsDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={t('districtsTitle', { name: editing.name ?? editing.invitedPhone ?? '' })} value={editing.districtIds} onSave={(ids) => update(editing, { districtIds: ids })} />}
    </div>
  );
}
