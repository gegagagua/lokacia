'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Activity, BarChart3, Building2, Clock, Copy, KeyRound, ShieldAlert, Trash2 } from 'lucide-react';
import { API_SCOPES, type ApiKeyCreated, type ApiKeyDto, type ApiScope, type ApiUsageDto } from '@lokacia/contracts';
import { Badge, Button, Checkbox, cn, Dialog, EmptyState, Field, Input, Select, Skeleton, useToast } from '@lokacia/ui';
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

  const createDialog = (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t('create')}
      trigger={
        <Button size="lg" icon={<KeyRound className="size-4" strokeWidth={2} aria-hidden />}>
          {t('create')}
        </Button>
      }
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
        <fieldset className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-4">
          <legend className="float-left mb-2 text-[15px] font-semibold">{t('scopes')}</legend>
          <div className="clear-both flex flex-col gap-2.5">
            {API_SCOPES.map((s) => (
              <Checkbox key={s} checked={scopes.includes(s)} onCheckedChange={(c) => setScopes((cur) => (c ? [...cur, s] : cur.filter((x) => x !== s)))} label={ts(s)} />
            ))}
          </div>
        </fieldset>
        <Button type="submit" size="lg" loading={busy} disabled={name.trim().length < 2 || !scopes.length}>
          {t('createSubmit')}
        </Button>
      </form>
    </Dialog>
  );

  return (
    <div className="mt-8 flex flex-col gap-6">
      {created && (
        <div className="relative overflow-hidden rounded-card border border-accent bg-accent-soft p-5 shadow-sm md:p-6" role="alert">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent text-accent-contrast">
              <ShieldAlert className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[18px] font-bold">{t('createdTitle')}</div>
              <p className="text-[15px] text-text/80">{t('createdWarning')}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 break-all rounded-button bg-[#0b1411] px-4 py-3 font-mono text-[14px] text-[#8fe0c8]">{created.key}</code>
            <Button
              variant="secondary"
              size="lg"
              icon={<Copy className="size-4" strokeWidth={2} aria-hidden />}
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
        </div>
      )}

      {!keys ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-card" />
          <Skeleton className="h-48 rounded-card" />
        </div>
      ) : !keys.length ? (
        <EmptyState icon={<KeyRound className="size-6" strokeWidth={2} aria-hidden />} title={t('empty')} description={t('emptyText')} action={createDialog} />
      ) : (
        <>
          <div className="flex justify-end">{createDialog}</div>
          <ul className="grid gap-4 md:grid-cols-2">
            {keys.map((k) => {
              const pct = Math.min(100, (k.usedThisMonth / Math.max(1, k.monthlyQuota)) * 100);
              const isCurrent = current === k.id;
              return (
                <li key={k.id} className={cn('flex flex-col rounded-card border bg-surface p-5 shadow-sm transition-all duration-200', k.revokedAt ? 'border-dashed border-border-strong bg-surface-2 shadow-none' : isCurrent ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-border-strong hover:shadow-md')}>
                  <div className="flex items-start gap-3">
                    <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', k.revokedAt ? 'bg-surface-2 text-muted' : 'bg-primary-soft text-primary-soft-text')}>
                      <KeyRound className="size-5" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[17px] font-bold">{k.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
                        {k.orgName && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="size-3.5" strokeWidth={2} aria-hidden />
                            {k.orgName}
                          </span>
                        )}
                        <code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[12.5px] text-text">{k.prefix}…</code>
                      </div>
                    </div>
                    {k.revokedAt ? <Badge tone="outline">{t('revokedBadge')}</Badge> : <Badge tone="primary">{k.planKey}</Badge>}
                  </div>

                  <div className="mt-5">
                    <div className="flex items-baseline justify-between gap-2 text-small">
                      <span className="text-muted">{t('used')}</span>
                      <span className="tabular">
                        <b className="text-[15px] font-bold">{fmt.number(k.usedThisMonth)}</b> <span className="text-muted">/ {fmt.number(k.monthlyQuota)}</span>
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <div className={cn('h-full rounded-full bg-gradient-to-r', pct > 85 ? 'from-accent to-danger' : 'from-primary-500 to-primary')} style={{ width: `${Math.max(pct, 1.5)}%` }} />
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-small">
                    <div className="rounded-xl bg-surface-2 px-3 py-2">
                      <dt className="flex items-center gap-1.5 text-muted">
                        <Activity className="size-3.5" strokeWidth={2} aria-hidden />
                        {t('plan')}
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular">{t('perMin', { n: k.rateLimitPerMin })}</dd>
                    </div>
                    <div className="rounded-xl bg-surface-2 px-3 py-2">
                      <dt className="flex items-center gap-1.5 text-muted">
                        <Clock className="size-3.5" strokeWidth={2} aria-hidden />
                        {t('lastUsed')}
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular">{k.lastUsedAt ? fmt.date(k.lastUsedAt) : '—'}</dd>
                    </div>
                  </dl>

                  {!k.revokedAt && (
                    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                      <Button size="sm" variant={isCurrent ? 'primary' : 'secondary'} onClick={() => setSelected(k.id)} aria-pressed={isCurrent} icon={<BarChart3 className="size-4" strokeWidth={2} aria-hidden />}>
                        {t('usage')}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => revoke(k)} icon={<Trash2 className="size-4" strokeWidth={2} aria-hidden />}>
                        {t('revoke')}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {current && <UsagePanel keyId={current} name={keys?.find((k) => k.id === current)?.name ?? ''} />}
    </div>
  );
}

function UsagePanel({ keyId, name }: { keyId: string; name: string }) {
  const t = useTranslations('developers.keys');
  const fmt = useFormat();
  const gid = React.useId().replace(/:/g, '');
  const { data } = useSWR<ApiUsageDto>(`/api-keys/${keyId}/usage`, fetcher);
  const [hover, setHover] = React.useState<number | null>(null);
  if (!data) return <Skeleton className="h-80 rounded-card" />;
  const days = data.days.slice(-30);
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((a, d) => a + d.count, 0);
  const avg = days.length ? Math.round(total / days.length) : 0;
  const pct = Math.min(100, (data.usedThisMonth / Math.max(1, data.monthlyQuota)) * 100);
  const W = 720;
  const H = 220;
  const pad = { l: 44, r: 8, t: 16, b: 28 };
  const bw = (W - pad.l - pad.r) / Math.max(1, days.length);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const epMax = Math.max(1, ...data.byEndpoint.map((e) => e.count));

  return (
    <section aria-label={t('usageTitle', { name })} className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 md:px-6">
        <h3 className="flex items-center gap-2.5 text-[19px] font-bold tracking-tight">
          <BarChart3 className="size-5 text-primary-soft-text" strokeWidth={2} aria-hidden />
          {t('usageTitle', { name })}
        </h3>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-small font-medium tabular text-muted">{t('quota', { used: fmt.number(data.usedThisMonth), quota: fmt.number(data.monthlyQuota) })}</span>
      </div>

      <div className="grid gap-6 p-5 md:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <dl className="grid grid-cols-3 gap-3">
            {[
              { l: t('used'), v: fmt.number(data.usedThisMonth) },
              { l: t('avgPerDay'), v: fmt.number(avg) },
              { l: t('quotaUsed'), v: `${Math.round(pct)}%` },
            ].map((s) => (
              <div key={s.l} className="flex flex-col-reverse rounded-2xl bg-surface-2 p-3 md:p-4">
                <dt className="mt-1 text-small text-muted">{s.l}</dt>
                <dd className="text-[22px] font-bold leading-tight tracking-tight tabular md:text-[26px]">{s.v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={data.monthlyQuota} aria-valuenow={data.usedThisMonth} aria-label={t('quotaLabel')}>
            <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary" style={{ width: `${Math.max(pct, 1)}%` }} />
          </div>
          {days.length > 0 ? (
            <div className="relative mt-5">
              <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label={t('chartLabel')}>
                <defs>
                  <linearGradient id={`${gid}-bar`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary-500)" />
                    <stop offset="100%" stopColor="var(--primary-500)" stopOpacity="0.35" />
                  </linearGradient>
                  <linearGradient id={`${gid}-hot`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.45" />
                  </linearGradient>
                </defs>
                {[0, Math.round(max / 2), max].map((v) => (
                  <g key={v}>
                    <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray={v === 0 ? undefined : '4 4'} />
                    <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
                      {fmt.number(v)}
                    </text>
                  </g>
                ))}
                {days.map((d, i) => {
                  const top = y(d.count);
                  const x = pad.l + i * bw;
                  const w = Math.max(2, bw - Math.max(2, bw * 0.28));
                  const h = Math.max(0, H - pad.b - top);
                  return (
                    <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                      <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill={hover === i ? 'var(--surface-2)' : 'transparent'} rx={4} />
                      <rect x={x + (bw - w) / 2} y={top} width={w} height={h} rx={Math.min(4, w / 2)} fill={`url(#${gid}-${d.count === max ? 'hot' : 'bar'})`} opacity={hover === null || hover === i ? 1 : 0.5} />
                      {i % 5 === 0 && (
                        <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
                          {d.day.slice(5)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
              {hover !== null && days[hover] && (
                <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl bg-text px-2.5 py-1.5 text-small font-medium tabular text-bg shadow-md" style={{ left: `${Math.min(88, Math.max(12, ((pad.l + (hover + 0.5) * bw) / W) * 100))}%` }} aria-hidden>
                  {days[hover]!.day} · {fmt.number(days[hover]!.count)}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-small text-muted">{t('noUsage')}</p>
          )}
        </div>

        <div className="min-w-0">
          <h4 className="text-small font-semibold text-muted">{t('byEndpoint')}</h4>
          <table className="mt-3 w-full text-small">
            <caption className="sr-only">{t('byEndpoint')}</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">{t('endpoint')}</th>
                <th scope="col">{t('requests')}</th>
              </tr>
            </thead>
            <tbody>
              {data.byEndpoint.map((e) => (
                <tr key={e.endpoint} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-border py-3 last:border-0">
                  <td className="min-w-0">
                    <code className="break-all font-mono text-[12.5px]">{e.endpoint}</code>
                  </td>
                  <td className="text-right font-semibold tabular">{fmt.number(e.count)}</td>
                  <td className="col-span-2 mt-2 block" aria-hidden>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-gradient-to-r from-link/50 to-link" style={{ width: `${(e.count / epMax) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
