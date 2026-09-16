'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Copy, KeyRound } from 'lucide-react';
import { API_SCOPES, type ApiKeyCreated, type ApiKeyDto, type ApiScope, type ApiUsageDto } from '@lokacia/contracts';
import { Badge, Button, Card, Checkbox, Dialog, EmptyState, Field, Input, Select, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';

export function KeyManager({ orgs }: { orgs: { id: string; name: string }[] }) {
  const t = useTranslations('developers.keys');
  const ts = useTranslations('developers.scopeLabels');
  const fmt = useFormat();
  const toast = useToast();
  const { data: keys, mutate } = useSWR<ApiKeyDto[]>('/api-keys', fetcher);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [scopes, setScopes] = React.useState<ApiScope[]>([...API_SCOPES]);
  const [orgId, setOrgId] = React.useState(orgs[0]?.id ?? '');
  const [busy, setBusy] = React.useState(false);
  const [created, setCreated] = React.useState<ApiKeyCreated | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const k = await apiFetch<ApiKeyCreated>('/api-keys', { method: 'POST', body: { name, scopes, orgId: orgId || null } });
      setCreated(k);
      setOpen(false);
      setName('');
      await mutate();
    } catch (err) {
      toast({ title: t('createError'), description: err instanceof ClientApiError ? err.message : undefined, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (k: ApiKeyDto) => {
    if (!window.confirm(t('revokeConfirm', { name: k.name }))) return;
    try {
      await apiFetch(`/api-keys/${k.id}`, { method: 'DELETE' });
      toast({ title: t('revoked'), tone: 'success' });
      await mutate();
    } catch (err) {
      toast({ title: t('createError'), description: err instanceof ClientApiError ? err.message : undefined, tone: 'danger' });
    }
  };

  const activeKeys = (keys ?? []).filter((k) => !k.revokedAt);
  const current = selected ?? activeKeys[0]?.id ?? null;

  return (
    <div className="mt-4 flex flex-col gap-4">
      {created && (
        <Card className="border-accent p-4" role="alert">
          <div className="font-semibold">{t('createdTitle')}</div>
          <p className="text-small text-muted">{t('createdWarning')}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 break-all rounded-button border border-border bg-surface-2 px-3 py-2 text-small">{created.key}</code>
            <Button
              variant="secondary"
              icon={<Copy className="size-4" strokeWidth={1.5} aria-hidden />}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(created.key);
                  toast({ title: t('copied'), tone: 'success' });
                } catch {
                  /* clipboard blocked */
                }
              }}
            >
              {t('copy')}
            </Button>
          </div>
          <Button variant="link" size="sm" className="mt-2" onClick={() => setCreated(null)}>
            {t('savedIt')}
          </Button>
        </Card>
      )}

      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title={t('create')}
          trigger={<Button icon={<KeyRound className="size-4" strokeWidth={1.5} aria-hidden />}>{t('create')}</Button>}
        >
          <form onSubmit={create} className="flex flex-col gap-4">
            <Field label={t('name')} required>
              <Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required />
            </Field>
            {orgs.length > 0 && (
              <Field label={t('org')}>
                <Select value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder={t('personal')} options={orgs.map((o) => ({ value: o.id, label: o.name }))} />
              </Field>
            )}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[15px] font-medium">{t('scopes')}</legend>
              {API_SCOPES.map((s) => (
                <Checkbox key={s} checked={scopes.includes(s)} onCheckedChange={(c) => setScopes((cur) => (c ? [...cur, s] : cur.filter((x) => x !== s)))} label={ts(s)} />
              ))}
            </fieldset>
            <Button type="submit" loading={busy} disabled={name.trim().length < 2 || !scopes.length}>
              {t('createSubmit')}
            </Button>
          </form>
        </Dialog>
      </div>

      {!keys ? null : !keys.length ? (
        <EmptyState title={t('empty')} description={t('emptyText')} />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-[640px] border-collapse bg-surface text-small">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-3 font-medium">{t('name')}</th>
                <th scope="col" className="p-3 font-medium">{t('prefix')}</th>
                <th scope="col" className="p-3 font-medium">{t('plan')}</th>
                <th scope="col" className="p-3 font-medium">{t('used')}</th>
                <th scope="col" className="p-3 font-medium">{t('lastUsed')}</th>
                <th scope="col" className="p-3"><span className="sr-only">{t('actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className={`border-b border-border last:border-0 ${k.revokedAt ? 'text-muted' : ''}`}>
                  <td className="p-3">
                    <div className="font-medium">{k.name}</div>
                    {k.orgName && <div className="text-muted">{k.orgName}</div>}
                  </td>
                  <td className="p-3"><code>{k.prefix}…</code></td>
                  <td className="p-3">
                    {k.planKey} · {t('perMin', { n: k.rateLimitPerMin })}
                  </td>
                  <td className="p-3 tabular">
                    {fmt.number(k.usedThisMonth)} / {fmt.number(k.monthlyQuota)}
                  </td>
                  <td className="p-3 tabular">{k.lastUsedAt ? fmt.date(k.lastUsedAt) : '—'}</td>
                  <td className="p-3 text-right">
                    {k.revokedAt ? (
                      <Badge tone="outline">{t('revokedBadge')}</Badge>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setSelected(k.id)} aria-pressed={current === k.id}>
                          {t('usage')}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => revoke(k)}>
                          {t('revoke')}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {current && <UsagePanel keyId={current} name={keys?.find((k) => k.id === current)?.name ?? ''} />}
    </div>
  );
}

function UsagePanel({ keyId, name }: { keyId: string; name: string }) {
  const t = useTranslations('developers.keys');
  const fmt = useFormat();
  const { data } = useSWR<ApiUsageDto>(`/api-keys/${keyId}/usage`, fetcher);
  const [hover, setHover] = React.useState<number | null>(null);
  if (!data) return null;
  const days = data.days.slice(-30);
  const max = Math.max(1, ...days.map((d) => d.count));
  const W = 720;
  const H = 180;
  const pad = { l: 44, r: 8, t: 12, b: 24 };
  const bw = (W - pad.l - pad.r) / Math.max(1, days.length);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-h3 font-semibold">{t('usageTitle', { name })}</h3>
        <span className="text-small tabular text-muted">
          {t('quota', { used: fmt.number(data.usedThisMonth), quota: fmt.number(data.monthlyQuota) })}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={data.monthlyQuota} aria-valuenow={data.usedThisMonth} aria-label={t('quotaLabel')}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (data.usedThisMonth / Math.max(1, data.monthlyQuota)) * 100)}%` }} />
      </div>
      {days.length > 0 ? (
        <div className="relative mt-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t('chartLabel')}>
            {[0, Math.round(max / 2), max].map((v) => (
              <g key={v}>
                <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" />
                <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
                  {fmt.number(v)}
                </text>
              </g>
            ))}
            {days.map((d, i) => {
              const top = y(d.count);
              const x = pad.l + i * bw;
              return (
                <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
                  <rect x={x + 1} y={top} width={Math.max(1, bw - 2)} height={Math.max(0, H - pad.b - top)} rx={Math.min(3, (bw - 2) / 2)} fill="var(--primary)" opacity={hover === null || hover === i ? 1 : 0.55} />
                  {i % 5 === 0 && (
                    <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
                      {d.day.slice(5)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {hover !== null && days[hover] && (
            <div className="pointer-events-none absolute top-0 rounded-[6px] border border-border bg-surface px-2 py-1 text-small tabular" style={{ left: `${Math.min(80, ((pad.l + hover * bw) / W) * 100)}%` }} aria-hidden>
              {days[hover]!.day}: {fmt.number(days[hover]!.count)}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-small text-muted">{t('noUsage')}</p>
      )}
      <table className="mt-4 w-full text-small">
        <caption className="sr-only">{t('byEndpoint')}</caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="py-2 font-medium">{t('endpoint')}</th>
            <th scope="col" className="py-2 text-right font-medium">{t('requests')}</th>
          </tr>
        </thead>
        <tbody>
          {data.byEndpoint.map((e) => (
            <tr key={e.endpoint} className="border-b border-border last:border-0">
              <td className="break-all py-2"><code>{e.endpoint}</code></td>
              <td className="py-2 text-right tabular">{fmt.number(e.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
