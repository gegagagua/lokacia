'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import {
  formatDateKa, formatDateTimeKa, formatMoney, MAINTENANCE_PRIORITY_LABELS_KA, MAINTENANCE_STATUS_LABELS_KA, RENT_STATUS_LABELS_KA, UTILITY_KIND_LABELS_KA,
  type CheckoutResponse, type LeaseDetailDto, type MaintenanceDto, type RentInvoiceDto,
} from '@lokacia/contracts';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Skeleton, Switch, Tabs, Textarea, useToast, type BadgeTone } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher, uploadFile } from '@/lib/api-client';
import { followCheckout } from '@/components/billing/checkout';

const RENT_TONE: Record<string, BadgeTone> = { paid: 'success', open: 'neutral', overdue: 'danger' };
const MAINT_TONE: Record<string, BadgeTone> = { open: 'neutral', in_progress: 'link', resolved: 'success' };

function useErr() {
  const toast = useToast();
  const t = useTranslations('property');
  return (e: unknown) => toast({ title: t('error'), description: e instanceof ClientApiError ? (e.problem?.errors?.map((x) => x.message).join('; ') || e.message) : undefined, tone: 'danger' });
}

export function LeaseDetailView({ id }: { id: string }) {
  const t = useTranslations('property');
  const { data, mutate, error } = useSWR<LeaseDetailDto>(`/property/leases/${id}`, fetcher);
  if (error) return <EmptyState title={t('notFound')} action={<Button asChild variant="secondary"><Link href="/account/property">{t('back')}</Link></Button>} />;
  if (!data) return <Skeleton className="h-64" />;
  const owner = data.myRole === 'owner';
  const refresh = () => void mutate();
  return (
    <div>
      <Link href="/account/property" className="inline-flex items-center gap-1 text-small text-link hover:underline">
        <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
        {t('back')}
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h2 font-semibold md:text-h1">{data.listing.title}</h1>
          <p className="text-muted">{data.listing.address}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge tone={owner ? 'primary' : 'link'}>{owner ? t('roleOwner') : t('roleTenant')}</Badge>
            {data.status === 'ended' && <Badge tone="outline">{t('ended')}</Badge>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-small">
          <dt className="text-muted">{owner ? t('tenant') : t('owner')}</dt>
          <dd>{owner ? `${data.tenantName}${data.tenantPhone ? ` · ${data.tenantPhone}` : ''}` : (data.ownerName ?? '—')}</dd>
          <dt className="text-muted">{t('rentAmount')}</dt>
          <dd className="tabular">{formatMoney(data.rentMinor)} · {t('dueDay', { n: data.dayOfMonth })}</dd>
          <dt className="text-muted">{t('period')}</dt>
          <dd className="tabular">
            {formatDateKa(data.startsOn)} – {data.endsOn ? formatDateKa(data.endsOn) : t('openEnded')}
          </dd>
          <dt className="text-muted">{t('balance')}</dt>
          <dd className={`tabular ${data.balanceDueMinor ? 'text-danger' : ''}`}>{formatMoney(data.balanceDueMinor)}</dd>
        </dl>
      </div>
      <Tabs
        className="mt-6"
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

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        {owner && (
          <div className="mb-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <a href={`/api/v1/property/leases/${lease.id}/export?format=csv`}>
                <Download className="size-4" strokeWidth={1.5} aria-hidden />
                CSV
              </a>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <a href={`/api/v1/property/leases/${lease.id}/export?format=xlsx`}>
                <FileSpreadsheet className="size-4" strokeWidth={1.5} aria-hidden />
                XLSX
              </a>
            </Button>
          </div>
        )}
        {!lease.invoices.length ? (
          <p className="text-muted">{t('empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full min-w-[560px] border-collapse bg-surface text-small">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="p-3 font-medium">{t('period')}</th>
                  <th scope="col" className="p-3 font-medium">{t('due')}</th>
                  <th scope="col" className="p-3 text-right font-medium">{t('amount')}</th>
                  <th scope="col" className="p-3 text-right font-medium">{t('penalty')}</th>
                  <th scope="col" className="p-3 font-medium">{t('status')}</th>
                  <th scope="col" className="p-3"><span className="sr-only">{t('actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {lease.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap p-3 tabular">{inv.period}</td>
                    <td className="whitespace-nowrap p-3 tabular">{formatDateKa(inv.dueOn)}</td>
                    <td className="whitespace-nowrap p-3 text-right tabular">{formatMoney(inv.amountMinor)}</td>
                    <td className="whitespace-nowrap p-3 text-right tabular">{inv.penaltyMinor ? formatMoney(inv.penaltyMinor) : '—'}</td>
                    <td className="p-3">
                      <Badge tone={RENT_TONE[inv.status] ?? 'neutral'}>{RENT_STATUS_LABELS_KA[inv.status]}</Badge>
                      {inv.paidAt && <div className="mt-1 text-muted">{formatDateKa(inv.paidAt)}</div>}
                    </td>
                    <td className="p-3 text-right">
                      {inv.status === 'paid' ? (
                        <Button asChild size="sm" variant="ghost">
                          <a href={`/api/v1/property/rent-invoices/${inv.id}/receipt.pdf`}>{t('receipt')}</a>
                        </Button>
                      ) : (
                        <Button size="sm" loading={paying === inv.id} onClick={() => pay(inv)}>
                          {t('pay', { amount: formatMoney(inv.totalMinor) })}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Card className="flex h-fit flex-col gap-4 p-4">
        <h3 className="font-semibold">{t('settings')}</h3>
        <Switch label={t('autopay')} checked={lease.autopay} disabled={saving || lease.status === 'ended'} onCheckedChange={(c) => patch({ autopay: c })} />
        <p className="-mt-2 text-small text-muted">{t('autopayHint')}</p>
        {owner && (
          <>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void patch({ penaltyPctPerDay: Number(penalty.replace(',', '.')) });
              }}
            >
              <Field label={t('penaltyPct')} className="flex-1">
                <Input inputMode="decimal" value={penalty} onChange={(e) => setPenalty(e.target.value)} suffix="%" />
              </Field>
              <Button type="submit" variant="secondary" loading={saving}>
                {t('save')}
              </Button>
            </form>
            {lease.status === 'active' && (
              <Button variant="danger" size="sm" disabled={saving} onClick={() => window.confirm(t('endConfirm')) && patch({ status: 'ended' })}>
                {t('end')}
              </Button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function MaintenanceTab({ lease, onChange }: { lease: LeaseDetailDto; onChange: () => void }) {
  const t = useTranslations('property.maintenance');
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

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        {!lease.maintenance.length ? (
          <p className="text-muted">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {lease.maintenance.map((m) => (
              <Card as="li" key={m.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{m.title}</div>
                    <div className="text-small text-muted">
                      {m.reporterName ?? '—'} · {formatDateKa(m.createdAt)} · {t('priority')}: {MAINTENANCE_PRIORITY_LABELS_KA[m.priority]}
                    </div>
                  </div>
                  {owner ? (
                    <Select aria-label={t('status')} className="h-8 w-auto text-small" value={m.status} onChange={(e) => setStatus(m, e.target.value)} options={Object.entries(MAINTENANCE_STATUS_LABELS_KA).map(([value, label]) => ({ value, label }))} />
                  ) : (
                    <Badge tone={MAINT_TONE[m.status] ?? 'neutral'}>{MAINTENANCE_STATUS_LABELS_KA[m.status]}</Badge>
                  )}
                </div>
                {m.priority === 'urgent' && m.status !== 'resolved' && <Badge tone="danger" className="mt-2">{MAINTENANCE_PRIORITY_LABELS_KA.urgent}</Badge>}
                {m.description && <p className="mt-2 text-small">{m.description}</p>}
                {m.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.photos.map((p, i) => (
                      <a key={p} href={p} target="_blank" rel="noopener" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p} alt={t('photoAlt', { n: i + 1 })} className="size-20 rounded-photo border border-border object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {m.resolvedAt && <p className="mt-2 text-small text-muted">{t('resolvedAt', { date: formatDateKa(m.resolvedAt) })}</p>}
              </Card>
            ))}
          </ul>
        )}
      </div>
      <Card className="h-fit p-4">
        <h3 className="font-semibold">{t('new')}</h3>
        <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
          <Field label={t('title')} required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} minLength={3} maxLength={200} required />
          </Field>
          <Field label={t('description')}>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label={t('priority')}>
            <Select value={priority} onChange={(e) => setPriority(e.target.value)} options={Object.entries(MAINTENANCE_PRIORITY_LABELS_KA).map(([value, label]) => ({ value, label }))} />
          </Field>
          <div className="flex flex-col gap-1">
            <label htmlFor="maint-photos" className="text-[15px] font-medium">
              {t('photos')}
            </label>
            <input id="maint-photos" type="file" accept="image/*" multiple disabled={uploading} onChange={(e) => onFiles(e.target.files)} className="text-small" />
            {uploading && <span className="text-small text-muted" aria-live="polite">{t('uploading')}</span>}
            {photos.length > 0 && <span className="text-small text-muted">{t('photosCount', { n: photos.length })}</span>}
          </div>
          <Button type="submit" loading={busy} disabled={uploading || title.trim().length < 3}>
            {t('submit')}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function UtilitiesTab({ lease, onChange }: { lease: LeaseDetailDto; onChange: () => void }) {
  const t = useTranslations('property.utilities');
  const onErr = useErr();
  const owner = lease.myRole === 'owner';
  const now = new Date();
  const [kind, setKind] = React.useState('electricity');
  const [period, setPeriod] = React.useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [reading, setReading] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const periods = [...new Set(lease.utilities.map((u) => u.period))].sort().reverse();
  const kinds = Object.keys(UTILITY_KIND_LABELS_KA) as (keyof typeof UTILITY_KIND_LABELS_KA)[];
  const usedKinds = kinds.filter((k) => lease.utilities.some((u) => u.kind === k));

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
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        {!periods.length ? (
          <p className="text-muted">{t('empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full min-w-[520px] border-collapse bg-surface text-small">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="p-3 font-medium">{t('period')}</th>
                  {usedKinds.map((k) => (
                    <th key={k} scope="col" className="p-3 text-right font-medium">
                      {UTILITY_KIND_LABELS_KA[k]}
                    </th>
                  ))}
                  <th scope="col" className="p-3 text-right font-medium">{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => {
                  const rows = lease.utilities.filter((u) => u.period === p);
                  return (
                    <tr key={p} className="border-b border-border last:border-0">
                      <th scope="row" className="p-3 text-left font-normal tabular">{p}</th>
                      {usedKinds.map((k) => {
                        const r = rows.find((x) => x.kind === k);
                        return (
                          <td key={k} className="whitespace-nowrap p-3 text-right tabular">
                            {r ? formatMoney(r.amountMinor) : '—'}
                            {r?.reading != null && <div className="text-muted">{t('reading', { value: r.reading })}</div>}
                          </td>
                        );
                      })}
                      <td className="p-3 text-right font-medium tabular">{formatMoney(rows.reduce((a, r) => a + r.amountMinor, 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {owner && (
        <Card className="h-fit p-4">
          <h3 className="font-semibold">{t('add')}</h3>
          <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
            <Field label={t('kind')}>
              <Select value={kind} onChange={(e) => setKind(e.target.value)} options={kinds.map((k) => ({ value: k, label: UTILITY_KIND_LABELS_KA[k] }))} />
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
        </Card>
      )}
    </div>
  );
}

function MessagesTab({ lease, onChange }: { lease: LeaseDetailDto; onChange: () => void }) {
  const t = useTranslations('property.messages');
  const onErr = useErr();
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);
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
    <div className="max-w-2xl">
      {!lease.messages.length ? (
        <p className="text-muted">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {lease.messages.map((m) => (
            <li key={m.id} className={`max-w-[85%] rounded-card border px-3 py-2 ${m.fromMe ? 'self-end border-primary/30 bg-primary/10' : 'self-start border-border bg-surface'}`}>
              <p className="whitespace-pre-wrap text-[15px]">{m.body}</p>
              <time className="mt-1 block text-[12px] text-muted tabular" dateTime={m.createdAt}>
                {formatDateTimeKa(m.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
        <Field label={t('label')}>
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
        </Field>
        <Button type="submit" className="self-end" loading={busy} disabled={!body.trim()}>
          {t('send')}
        </Button>
      </form>
    </div>
  );
}
