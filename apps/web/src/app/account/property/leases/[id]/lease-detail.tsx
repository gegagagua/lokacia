'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ArrowLeft, Building2, CalendarDays, Check, Clock, Download, ExternalLink, FileSpreadsheet, ImagePlus, MessageSquare, Receipt, Send, Settings2, Wallet, Wrench, Zap } from 'lucide-react';
import { type CheckoutResponse, type LeaseDetailDto, type MaintenanceDto, type RentInvoiceDto } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Avatar, Badge, Button, cn, EmptyState, Field, Input, Select, Skeleton, Switch, Tabs, Textarea, useToast, type BadgeTone } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher, uploadFile } from '@/lib/api-client';
import { followCheckout } from '@/components/billing/checkout';
import { withBase } from '@/lib/base-path';

const RENT_TONE: Record<string, BadgeTone> = { paid: 'success', open: 'neutral', overdue: 'danger' };
const MAINT_TONE: Record<string, BadgeTone> = { open: 'neutral', in_progress: 'link', resolved: 'success' };
const MAINT_STATUSES = ['open', 'in_progress', 'resolved'] as const;
const MAINT_PRIORITIES = ['low', 'normal', 'urgent'] as const;
const UTILITY_KINDS = ['electricity', 'water', 'gas', 'cleaning', 'internet'] as const;
const UTILITY_COLOR: Record<string, string> = { electricity: 'var(--accent)', water: 'var(--link)', gas: 'var(--danger)', cleaning: 'var(--primary-500)', internet: 'var(--text-muted)' };

function useErr() {
  const toast = useToast();
  const t = useTranslations('property');
  return (e: unknown) => toast({ title: t('error'), description: e instanceof ClientApiError ? (e.problem?.errors?.map((x) => x.message).join('; ') || e.message) : undefined, tone: 'danger' });
}

function PanelTitle({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2.5 text-[17px] font-bold">
      <span className="grid size-8 place-items-center rounded-xl bg-primary-soft text-primary-soft-text">
        <Icon className="size-4" strokeWidth={2} aria-hidden />
      </span>
      {children}
    </h3>
  );
}

export function LeaseDetailView({ id }: { id: string }) {
  const t = useTranslations('property');
  const f = useFormat();
  const { data, mutate, error } = useSWR<LeaseDetailDto>(`/property/leases/${id}`, fetcher);
  if (error) return <EmptyState title={t('notFound')} action={<Button asChild variant="secondary"><Link href="/account/property">{t('back')}</Link></Button>} />;
  if (!data)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  const owner = data.myRole === 'owner';
  const refresh = () => void mutate();
  const counterpart = owner ? data.tenantName : (data.ownerName ?? '—');
  const owes = data.balanceDueMinor > 0;

  return (
    <div>
      <Link href="/account/property" className="inline-flex items-center gap-1.5 rounded-full py-1 pr-3 text-small font-medium text-muted transition-colors hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
        {t('back')}
      </Link>

      <header className="card mt-4 overflow-hidden">
        <div className="grid md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="relative h-40 bg-surface-2 md:h-full">
            {data.listing.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.listing.cover} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <div className="drawing-grid absolute inset-0 grid place-items-center text-muted" aria-hidden>
                <Building2 className="size-10" strokeWidth={1.5} />
              </div>
            )}
          </div>
          <div className="min-w-0 p-5 md:p-6">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={owner ? 'primary' : 'link'}>{owner ? t('roleOwner') : t('roleTenant')}</Badge>
              {data.status === 'ended' ? <Badge tone="outline">{t('ended')}</Badge> : <Badge tone="success">{t('active')}</Badge>}
              {data.autopay && <Badge tone="neutral">{t('autopay')}</Badge>}
            </div>
            <h1 className="mt-3 text-[26px] font-bold leading-tight tracking-tight md:text-[32px]">{data.listing.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
              {data.listing.address}
              <Link href={`/listings/${data.listing.slug}`} className="inline-flex items-center gap-1 text-small font-medium text-link hover:underline">
                {t('openListing')}
                <ExternalLink className="size-3.5" strokeWidth={2} aria-hidden />
              </Link>
            </p>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-2xl bg-surface-2 px-3.5 py-3">
                <dt className="text-small text-muted">{owner ? t('tenant') : t('owner')}</dt>
                <dd className="mt-0.5 flex min-w-0 items-center gap-2.5">
                  <Avatar name={counterpart.replace(/[„“"«»]/g, "")} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{counterpart}</span>
                    {owner && data.tenantPhone && <span className="block truncate text-small text-muted tabular">{data.tenantPhone}</span>}
                  </span>
                </dd>
              </div>
              <div className="rounded-2xl bg-surface-2 px-3.5 py-3">
                <dt className="text-small text-muted">{t('rentAmount')}</dt>
                <dd className="text-[18px] font-bold tabular">{f.money(data.rentMinor)}</dd>
                <dd className="text-small text-muted">{t('dueDay', { n: data.dayOfMonth })}</dd>
              </div>
              <div className="rounded-2xl bg-surface-2 px-3.5 py-3">
                <dt className="text-small text-muted">{t('period')}</dt>
                <dd className="font-semibold tabular">{f.date(data.startsOn)}</dd>
                <dd className="text-small text-muted tabular">→ {data.endsOn ? f.date(data.endsOn) : t('openEnded')}</dd>
              </div>
              <div className={cn('rounded-2xl px-3.5 py-3', owes ? 'bg-danger/10' : 'bg-success/12')}>
                <dt className={cn('text-small', owes ? 'text-danger' : 'text-success')}>{t('balance')}</dt>
                <dd className={cn('text-[22px] font-bold tabular', owes ? 'text-danger' : 'text-success')}>{f.money(data.balanceDueMinor)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      <Tabs
        className="mt-8"
        tabs={[
          { value: 'rent', label: t('tabs.rent'), count: data.invoices.filter((i) => i.status !== 'paid').length, content: <RentTab lease={data} onChange={refresh} /> },
          { value: 'maintenance', label: t('tabs.maintenance'), count: data.maintenance.filter((m) => m.status !== 'resolved').length, content: <MaintenanceTab lease={data} onChange={refresh} /> },
          { value: 'utilities', label: t('tabs.utilities'), content: <UtilitiesTab lease={data} onChange={refresh} /> },
          { value: 'messages', label: t('tabs.messages'), count: data.messages.length, content: <MessagesTab lease={data} onChange={refresh} /> },
        ]}
      />
    </div>
  );
}

function RentTab({ lease, onChange }: { lease: LeaseDetailDto; onChange: () => void }) {
  const t = useTranslations('property.rent');
  const f = useFormat();
  const tl = useTranslations('property.labels');
  const onErr = useErr();
  const toast = useToast();
  const owner = lease.myRole === 'owner';
  const [paying, setPaying] = React.useState<string | null>(null);
  const [penalty, setPenalty] = React.useState(String(lease.penaltyPctPerDay));
  const [saving, setSaving] = React.useState(false);

  const pay = async (inv: RentInvoiceDto) => {
    setPaying(inv.id);
    try {
      followCheckout(await apiFetch<CheckoutResponse>(`/property/rent-invoices/${inv.id}/pay`, { method: 'POST' }));
    } catch (e) {
      onErr(e);
      setPaying(null);
    }
  };
  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      await apiFetch(`/property/leases/${lease.id}`, { method: 'PATCH', body });
      toast({ title: t('saved'), tone: 'success' });
      onChange();
    } catch (e) {
      onErr(e);
    } finally {
      setSaving(false);
    }
  };

  const dot = { paid: 'bg-success text-white', open: 'bg-surface text-muted ring-2 ring-border-strong', overdue: 'bg-danger text-white' } as Record<string, string>;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="card min-w-0 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle icon={Receipt}>{t('timeline')}</PanelTitle>
          {owner && (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <a href={withBase(`/api/v1/property/leases/${lease.id}/export?format=csv`)}>
                  <Download className="size-4" strokeWidth={2} aria-hidden />
                  CSV
                </a>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <a href={withBase(`/api/v1/property/leases/${lease.id}/export?format=xlsx`)}>
                  <FileSpreadsheet className="size-4" strokeWidth={2} aria-hidden />
                  XLSX
                </a>
              </Button>
            </div>
          )}
        </div>
        {!lease.invoices.length ? (
          <p className="mt-5 text-muted">{t('empty')}</p>
        ) : (
          <ol className="relative mt-6">
            {lease.invoices.map((inv, i) => (
              <li key={inv.id} className="relative flex gap-4 pb-5 last:pb-0">
                {i < lease.invoices.length - 1 && <span aria-hidden className="absolute left-[15px] top-9 h-[calc(100%-28px)] w-0.5 rounded-full bg-border" />}
                <span aria-hidden className={cn('relative mt-1 grid size-8 shrink-0 place-items-center rounded-full', dot[inv.status] ?? dot.open)}>
                  {inv.status === 'paid' ? <Check className="size-4" strokeWidth={3} /> : inv.status === 'overdue' ? <AlertTriangle className="size-4" strokeWidth={2.5} /> : <Clock className="size-4" strokeWidth={2.5} />}
                </span>
                <div className={cn('flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border px-4 py-3', inv.status === 'overdue' ? 'border-danger/30 bg-danger/5' : 'border-border bg-surface')}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold tabular">{inv.period}</span>
                      <Badge tone={RENT_TONE[inv.status] ?? 'neutral'}>{tl(`rentStatus.${inv.status}`)}</Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-small text-muted tabular">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5" strokeWidth={2} aria-hidden />
                        <span className="sr-only">{t('due')}: </span>
                        {f.date(inv.dueOn)}
                      </span>
                      {inv.paidAt && (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                          {f.date(inv.paidAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right tabular">
                    <div className="font-bold">
                      <span className="sr-only">{t('amount')}: </span>
                      {f.money(inv.amountMinor)}
                    </div>
                    {inv.penaltyMinor > 0 && (
                      <div className="text-small font-medium text-danger">
                        + {t('penalty')} {f.money(inv.penaltyMinor)}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {inv.status === 'paid' ? (
                      <Button asChild size="sm" variant="ghost">
                        <a href={withBase(`/api/v1/property/rent-invoices/${inv.id}/receipt.pdf`)}>
                          <Download className="size-4" strokeWidth={2} aria-hidden />
                          {t('receipt')}
                        </a>
                      </Button>
                    ) : (
                      <Button size="sm" loading={paying === inv.id} onClick={() => pay(inv)}>
                        {t('pay', { amount: f.money(inv.totalMinor) })}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="card flex h-fit flex-col gap-4 p-5 xl:sticky xl:top-24">
        <PanelTitle icon={Settings2}>{t('settings')}</PanelTitle>
        <div className="rounded-2xl bg-surface-2 p-4">
          <Switch label={t('autopay')} checked={lease.autopay} disabled={saving || lease.status === 'ended'} onCheckedChange={(c) => patch({ autopay: c })} />
          <p className="mt-2 text-small text-muted">{t('autopayHint')}</p>
        </div>
        {owner && (
          <>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void patch({ penaltyPctPerDay: Number(penalty.replace(',', '.')) });
              }}
            >
              <Field label={t('penaltyPct')} className="min-w-0 flex-1">
                <Input inputMode="decimal" value={penalty} onChange={(e) => setPenalty(e.target.value)} suffix="%" />
              </Field>
              <Button type="submit" variant="secondary" loading={saving}>
                {t('save')}
              </Button>
            </form>
            {lease.status === 'active' && (
              <Button variant="danger" size="sm" className="mt-1" disabled={saving} onClick={() => window.confirm(t('endConfirm')) && patch({ status: 'ended' })}>
                {t('end')}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MaintenanceTab({ lease, onChange }: { lease: LeaseDetailDto; onChange: () => void }) {
  const t = useTranslations('property.maintenance');
  const f = useFormat();
  const tl = useTranslations('property.labels');
  const onErr = useErr();
  const toast = useToast();
  const owner = lease.myRole === 'owner';
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState('normal');
  const [photos, setPhotos] = React.useState<{ id: string; name: string }[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 10 - photos.length)) {
        const id = await uploadFile(f, { kind: 'photo' });
        setPhotos((p) => [...p, { id, name: f.name }]);
      }
    } catch (e) {
      onErr(e);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch(`/property/leases/${lease.id}/maintenance`, { method: 'POST', body: { title, description: description || null, priority, photos: photos.map((p) => p.id) } });
      toast({ title: t('created'), tone: 'success' });
      setTitle('');
      setDescription('');
      setPhotos([]);
      onChange();
    } catch (err) {
      onErr(err);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (m: MaintenanceDto, status: string) => {
    try {
      await apiFetch(`/property/maintenance/${m.id}`, { method: 'PATCH', body: { status } });
      onChange();
    } catch (e) {
      onErr(e);
    }
  };

  const colStyle = { open: 'bg-muted', in_progress: 'bg-link', resolved: 'bg-success' } as Record<string, string>;

  return (
    <div className="flex flex-col gap-6">
      {!lease.maintenance.length ? (
        <EmptyState icon={<Wrench className="size-6" strokeWidth={2} aria-hidden />} title={t('empty')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {MAINT_STATUSES.map((col) => {
            const items = lease.maintenance.filter((m) => m.status === col);
            return (
              <section key={col} aria-label={tl(`maintenanceStatus.${col}`)} className="flex min-w-0 flex-col rounded-card bg-surface-2 p-3">
                <div className="flex items-center gap-2 px-2 pb-3 pt-1">
                  <span aria-hidden className={cn('size-2.5 rounded-full', colStyle[col])} />
                  <h3 className="font-semibold">{tl(`maintenanceStatus.${col}`)}</h3>
                  <span className="ml-auto rounded-full bg-surface px-2 text-small font-semibold tabular text-muted">{items.length}</span>
                </div>
                <ul className="flex flex-col gap-3">
                  {!items.length && <li className="rounded-2xl border border-dashed border-border-strong px-3 py-6 text-center text-small text-muted">{t('columnEmpty')}</li>}
                  {items.map((m) => (
                    <li key={m.id} className={cn('rounded-2xl border bg-surface p-4 shadow-xs', m.priority === 'urgent' && m.status !== 'resolved' ? 'border-danger/40' : 'border-border')}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {m.priority === 'urgent' && m.status !== 'resolved' ? (
                          <Badge tone="danger" icon={<Zap className="size-3" strokeWidth={2.5} aria-hidden />}>
                            {tl('maintenancePriority.urgent')}
                          </Badge>
                        ) : (
                          <Badge tone="outline">{tl(`maintenancePriority.${m.priority}`)}</Badge>
                        )}
                        {!owner && <Badge tone={MAINT_TONE[m.status] ?? 'neutral'}>{tl(`maintenanceStatus.${m.status}`)}</Badge>}
                      </div>
                      <div className="mt-2 font-semibold leading-snug">{m.title}</div>
                      {m.description && <p className="mt-1 text-small text-muted">{m.description}</p>}
                      {m.photos.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {m.photos.map((p, i) => (
                            <a key={p} href={p} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p} alt={t('photoAlt', { n: i + 1 })} className="size-16 object-cover transition-transform hover:scale-105" />
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-small text-muted">
                        <Avatar name={m.reporterName ?? '?'} size={24} />
                        <span className="min-w-0 flex-1 truncate">{m.reporterName ?? '—'}</span>
                        <span className="tabular">{f.date(m.createdAt)}</span>
                      </div>
                      {m.resolvedAt && <p className="mt-2 text-small font-medium text-success">{t('resolvedAt', { date: f.date(m.resolvedAt) })}</p>}
                      {owner && (
                        <Select aria-label={t('status')} className="mt-3 h-9 text-small" value={m.status} onChange={(e) => setStatus(m, e.target.value)} options={MAINT_STATUSES.map((value) => ({ value, label: tl(`maintenanceStatus.${value}`) }))} />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      <div className="card p-5 md:p-6">
        <PanelTitle icon={Wrench}>{t('new')}</PanelTitle>
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label={t('title')} required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} minLength={3} maxLength={200} required />
          </Field>
          <Field label={t('priority')}>
            <Select value={priority} onChange={(e) => setPriority(e.target.value)} options={MAINT_PRIORITIES.map((value) => ({ value, label: tl(`maintenancePriority.${value}`) }))} />
          </Field>
          <Field label={t('description')} className="md:col-span-2">
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="maint-photos" className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-2/60 px-4 py-3 transition-colors hover:border-primary hover:bg-primary-soft/40 has-[:focus-visible]:shadow-ring">
              <span className="grid size-9 place-items-center rounded-xl bg-surface text-primary-soft-text shadow-xs">
                <ImagePlus className="size-4" strokeWidth={2} aria-hidden />
              </span>
              <span className="text-[15px] font-medium">{t('photos')}</span>
              {photos.length > 0 && <span className="ml-auto text-small text-muted">{t('photosCount', { n: photos.length })}</span>}
              <input id="maint-photos" type="file" accept="image/*" multiple disabled={uploading} onChange={(e) => onFiles(e.target.files)} className="sr-only" />
            </label>
            {uploading && (
              <span className="text-small text-muted" aria-live="polite">
                {t('uploading')}
              </span>
            )}
          </div>
          <div className="flex justify-end md:col-span-2">
            <Button type="submit" size="lg" loading={busy} disabled={uploading || title.trim().length < 3}>
              {t('submit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UtilitiesTab({ lease, onChange }: { lease: LeaseDetailDto; onChange: () => void }) {
  const t = useTranslations('property.utilities');
  const f = useFormat();
  const tl = useTranslations('property.labels');
  const onErr = useErr();
  const owner = lease.myRole === 'owner';
  const now = new Date();
  const [kind, setKind] = React.useState('electricity');
  const [period, setPeriod] = React.useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [reading, setReading] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const periods = [...new Set(lease.utilities.map((u) => u.period))].sort().reverse();
  const kinds = UTILITY_KINDS;
  const usedKinds = kinds.filter((k) => lease.utilities.some((u) => u.kind === k));
  const totals = periods.map((p) => lease.utilities.filter((u) => u.period === p).reduce((a, r) => a + r.amountMinor, 0));
  const maxTotal = Math.max(1, ...totals);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch(`/property/leases/${lease.id}/utilities`, { method: 'POST', body: { kind, period, reading: reading ? Number(reading.replace(',', '.')) : null, amountMinor: Math.round(Number(amount.replace(',', '.')) * 100) } });
      setReading('');
      setAmount('');
      onChange();
    } catch (err) {
      onErr(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('grid gap-6', owner && 'xl:grid-cols-[minmax(0,1fr)_300px]')}>
      <div className="card min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-0 md:p-6 md:pb-0">
          <PanelTitle icon={Zap}>{t('title')}</PanelTitle>
          <div className="flex flex-wrap gap-3 text-small text-muted" aria-hidden>
            {usedKinds.map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: UTILITY_COLOR[k] }} />
                {tl(`utilityKind.${k}`)}
              </span>
            ))}
          </div>
        </div>
        {!periods.length ? (
          <p className="p-5 text-muted md:p-6">{t('empty')}</p>
        ) : (
          <>
            <ul className="flex flex-col gap-3 p-5 md:p-6" aria-hidden>
              {periods.map((p, i) => {
                const rows = lease.utilities.filter((u) => u.period === p);
                return (
                  <li key={p} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 text-small">
                    <span className="font-semibold tabular">{p}</span>
                    <span className="flex h-3 overflow-hidden rounded-full bg-surface-2" style={{ width: `${Math.max(8, (totals[i]! / maxTotal) * 100)}%` }}>
                      {usedKinds.map((k) => {
                        const r = rows.find((x) => x.kind === k);
                        return r ? <span key={k} className="h-full" style={{ width: `${(r.amountMinor / Math.max(1, totals[i]!)) * 100}%`, background: UTILITY_COLOR[k] }} /> : null;
                      })}
                    </span>
                    <span className="font-bold tabular">{f.money(totals[i]!)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full min-w-[520px] border-collapse text-[15px]">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left text-small text-muted">
                    <th scope="col" className="px-5 py-3 font-semibold">{t('period')}</th>
                    {usedKinds.map((k) => (
                      <th key={k} scope="col" className="px-5 py-3 text-right font-semibold">
                        {tl(`utilityKind.${k}`)}
                      </th>
                    ))}
                    <th scope="col" className="px-5 py-3 text-right font-semibold">{t('total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p, i) => {
                    const rows = lease.utilities.filter((u) => u.period === p);
                    return (
                      <tr key={p} className="border-b border-border last:border-0">
                        <th scope="row" className="px-5 py-3 text-left font-semibold tabular">{p}</th>
                        {usedKinds.map((k) => {
                          const r = rows.find((x) => x.kind === k);
                          return (
                            <td key={k} className="whitespace-nowrap px-5 py-3 text-right tabular">
                              {r ? f.money(r.amountMinor) : '—'}
                              {r?.reading != null && <div className="text-small text-muted">{t('reading', { value: r.reading })}</div>}
                            </td>
                          );
                        })}
                        <td className="px-5 py-3 text-right font-bold tabular">{f.money(totals[i]!)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {owner && (
        <div className="card h-fit p-5 xl:sticky xl:top-24">
          <PanelTitle icon={Wallet}>{t('add')}</PanelTitle>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <Field label={t('kind')}>
              <Select value={kind} onChange={(e) => setKind(e.target.value)} options={kinds.map((k) => ({ value: k, label: tl(`utilityKind.${k}`) }))} />
            </Field>
            <Field label={t('period')}>
              <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
            </Field>
            <Field label={t('readingLabel')}>
              <Input inputMode="decimal" value={reading} onChange={(e) => setReading(e.target.value)} />
            </Field>
            <Field label={t('amount')} required>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} suffix="₾" required />
            </Field>
            <Button type="submit" loading={busy} disabled={!amount}>
              {t('submit')}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function MessagesTab({ lease, onChange }: { lease: LeaseDetailDto; onChange: () => void }) {
  const t = useTranslations('property.messages');
  const f = useFormat();
  const onErr = useErr();
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const counterpart = lease.myRole === 'owner' ? lease.tenantName : (lease.ownerName ?? '—');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch(`/property/leases/${lease.id}/messages`, { method: 'POST', body: { body } });
      setBody('');
      onChange();
    } catch (err) {
      onErr(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card mx-auto flex max-w-3xl flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <Avatar name={counterpart.replace(/[„“"«»]/g, "")} size={40} />
        <div className="min-w-0">
          <div className="truncate font-semibold">{counterpart}</div>
          <div className="truncate text-small text-muted">{lease.listing.title}</div>
        </div>
      </div>
      <div className="drawing-grid min-h-[240px] px-4 py-5 md:px-6">
        {!lease.messages.length ? (
          <div className="grid h-full min-h-[200px] place-items-center text-center text-muted">
            <div className="flex flex-col items-center gap-2">
              <MessageSquare className="size-8" strokeWidth={1.5} aria-hidden />
              <p>{t('empty')}</p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3" aria-live="polite">
            {lease.messages.map((m) => (
              <li key={m.id} className={cn('max-w-[85%] px-4 py-2.5 shadow-xs', m.fromMe ? 'self-end rounded-[18px] rounded-br-md bg-primary text-primary-contrast' : 'self-start rounded-[18px] rounded-bl-md border border-border bg-surface')}>
                <p className="whitespace-pre-wrap text-[15px]">{m.body}</p>
                <time className={cn('mt-1 block text-right text-[12px] tabular', m.fromMe ? 'text-primary-contrast/80' : 'text-muted')} dateTime={m.createdAt}>
                  {f.dateTime(m.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2 border-t border-border p-4">
        <Field label={t('label')}>
          <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
        </Field>
        <Button type="submit" className="self-end" loading={busy} disabled={!body.trim()} icon={<Send className="size-4" strokeWidth={2} aria-hidden />}>
          {t('send')}
        </Button>
      </form>
    </div>
  );
}
