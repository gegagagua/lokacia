'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, MapPin, Minus } from 'lucide-react';
import { CRM_PERMISSIONS, CRM_ROLE_PERMISSIONS, ORG_ROLES, type LeadDistributionMode, type TeamMemberStats } from '@lokacia/contracts';
import { Avatar, Badge, Button, Card, Field, Input, Select, Skeleton, Switch, Table, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { DistributionSettings } from '@/components/team/distribution-settings';
import { DistrictsDialog, useDistricts } from '@/components/team/districts-dialog';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';

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

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {!data ? (
        <Skeleton className="h-64" />
      ) : (
        <Table
          rows={data.members}
          rowKey={(m) => m.id}
          initialSort={{ key: 'openDeals', dir: 'desc' }}
          columns={[
            {
              key: 'name',
              header: t('name'),
              sortValue: (m) => m.name ?? m.invitedPhone ?? '',
              cell: (m) => (
                <div className="flex items-center gap-2">
                  <Avatar src={m.avatarUrl} name={m.name ?? m.invitedPhone} size={28} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{m.name ?? m.invitedPhone}</div>
                    <div className="text-small text-muted tabular">{m.userId ? m.phone : t('invited')}</div>
                  </div>
                </div>
              ),
            },
            {
              key: 'role',
              header: t('role'),
              sortValue: (m) => m.role,
              cell: (m) =>
                manage && m.userId !== user.id ? (
                  <Select aria-label={t('role')} value={m.role} onChange={(e) => update(m, { role: e.target.value })} options={ORG_ROLES.map((r) => ({ value: r, label: roles(r) }))} className="h-8 w-36" />
                ) : (
                  <Badge tone={m.role === 'manager' ? 'primary' : 'neutral'}>{roles(m.role)}</Badge>
                ),
            },
            {
              key: 'districts',
              header: t('districts'),
              cell: (m) => (
                <button type="button" disabled={!manage} onClick={() => setEditing(m)} className="flex max-w-56 items-center gap-1 text-left text-small hover:underline disabled:no-underline" aria-label={t('editDistricts')}>
                  <MapPin className="size-3.5 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
                  <span className="truncate">{m.districtIds.length ? m.districtIds.map(districtName).join(', ') : t('noDistricts')}</span>
                </button>
              ),
            },
            { key: 'contacts', header: t('stats.contacts'), align: 'right', cell: (m) => m.stats.contacts, sortValue: (m) => m.stats.contacts },
            { key: 'openDeals', header: t('stats.openDeals'), align: 'right', cell: (m) => m.stats.openDeals, sortValue: (m) => m.stats.openDeals },
            { key: 'won', header: t('stats.wonThisMonth'), align: 'right', cell: (m) => m.stats.wonThisMonth, sortValue: (m) => m.stats.wonThisMonth },
            { key: 'overdue', header: t('stats.overdueTasks'), align: 'right', cell: (m) => <span className={m.stats.overdueTasks ? 'text-danger' : ''}>{m.stats.overdueTasks}</span>, sortValue: (m) => m.stats.overdueTasks },
            { key: 'active', header: t('active'), align: 'center', cell: (m) => <Switch aria-label={t('active')} checked={m.active} disabled={!manage || m.userId === user.id} onCheckedChange={(v) => update(m, { active: v })} /> },
          ]}
        />
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {data && <DistributionSettings value={data.leadDistribution} />}
        {manage && (
          <Card className="p-4">
            <h2 className="mb-3 font-semibold">{t('invite.title')}</h2>
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
              <Button type="submit" loading={busy}>
                {t('invite.submit')}
              </Button>
            </form>
          </Card>
        )}
      </div>
      <Card className="p-4">
        <h2 className="mb-3 font-semibold">{t('permissions.title')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px] tabular">
            <thead>
              <tr className="border-b border-border-strong text-left text-small text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">{t('permissions.permission')}</th>
                {ORG_ROLES.map((r) => (
                  <th key={r} scope="col" className="px-3 py-2 text-center font-medium">{roles(r)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CRM_PERMISSIONS.map((p) => (
                <tr key={p} className="border-b border-border last:border-b-0">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">{t(`permissions.list.${p.replace(".", "_")}`)}</th>
                  {ORG_ROLES.map((r) => (
                    <td key={r} className="px-3 py-1.5 text-center">
                      {CRM_ROLE_PERMISSIONS[r].includes(p) ? <Check className="mx-auto size-4 text-success" strokeWidth={1.5} aria-label="✓" /> : <Minus className="mx-auto size-4 text-muted" strokeWidth={1.5} aria-label="—" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {editing && <DistrictsDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={t('districtsTitle', { name: editing.name ?? editing.invitedPhone ?? '' })} value={editing.districtIds} onSave={(ids) => update(editing, { districtIds: ids })} />}
    </div>
  );
}
