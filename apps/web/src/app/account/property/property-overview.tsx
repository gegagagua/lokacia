'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Plus, Wrench } from 'lucide-react';
import { type ListingCard, type LeaseDto, type PropertyOverview } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Badge, Button, Checkbox, Dialog, EmptyState, Field, Input, Select, Skeleton, Stat, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';

export function PropertyOverviewView() {
  const t = useTranslations('property');
  const f = useFormat();
  const { data, mutate, error } = useSWR<PropertyOverview>('/property/overview', fetcher);
  if (error) return <p className="mt-6 text-danger">{t('loadError')}</p>;
  if (!data) return <Skeleton className="mt-6 h-48" />;
  const owned = data.leases.filter((l) => l.myRole === 'owner');
  const rented = data.leases.filter((l) => l.myRole === 'tenant');
  return (
    <div className="mt-6 flex min-w-0 flex-col gap-10 [&>*]:min-w-0">
      {owned.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={t('totals.monthly')} value={f.money(data.totals.monthlyRentMinor)} />
          <Stat label={t('totals.collected')} value={f.money(data.totals.collectedThisMonthMinor)} />
          <Stat label={t('totals.overdue')} value={<span className={data.totals.overdueMinor ? 'text-danger' : ''}>{f.money(data.totals.overdueMinor)}</span>} />
          <Stat label={t('totals.maintenance')} value={data.totals.openMaintenance} />
        </div>
      )}

      <section aria-labelledby="owned">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="owned" className="text-h3 font-semibold md:text-h2">{t('portfolio')}</h2>
          <AddLeaseDialog onCreated={() => mutate()} />
        </div>
        {!owned.length ? <EmptyState className="mt-4" title={t('noOwned')} description={t('noOwnedText')} /> : <LeaseGrid leases={owned} />}
      </section>

      {rented.length > 0 && (
        <section aria-labelledby="rented">
          <h2 id="rented" className="text-h3 font-semibold md:text-h2">{t('myLeases')}</h2>
          <LeaseGrid leases={rented} />
        </section>
      )}
    </div>
  );
}

function LeaseGrid({ leases }: { leases: LeaseDto[] }) {
  const t = useTranslations('property');
  const f = useFormat();
  return (
    <ul className="mt-4 grid gap-3 md:grid-cols-2">
      {leases.map((l) => (
        <li key={l.id} className="min-w-0">
          <Link href={`/account/property/leases/${l.id}`} className="flex h-full flex-col gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong">
            <div className="flex items-start gap-3">
              {l.listing.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.listing.cover} alt="" className="size-16 shrink-0 rounded-photo border border-border object-cover" />
              ) : (
                <div className="size-16 shrink-0 rounded-photo border border-border bg-surface-2" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{l.listing.title}</div>
                <div className="truncate text-small text-muted">{l.listing.address}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone={l.myRole === 'owner' ? 'primary' : 'link'}>{l.myRole === 'owner' ? t('roleOwner') : t('roleTenant')}</Badge>
                  {l.status === 'ended' && <Badge tone="outline">{t('ended')}</Badge>}
                  {l.autopay && <Badge tone="neutral">{t('autopay')}</Badge>}
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-small">
              <div>
                <dt className="text-muted">{l.myRole === 'owner' ? t('tenant') : t('owner')}</dt>
                <dd className="truncate">{l.myRole === 'owner' ? l.tenantName : (l.ownerName ?? '—')}</dd>
              </div>
              <div>
                <dt className="text-muted">{t('rentAmount')}</dt>
                <dd className="tabular">{f.money(l.rentMinor)}</dd>
              </div>
              <div>
                <dt className="text-muted">{t('balance')}</dt>
                <dd className={`tabular ${l.balanceDueMinor > 0 ? 'text-danger' : ''}`}>{f.money(l.balanceDueMinor)}</dd>
              </div>
              <div>
                <dt className="text-muted">{t('nextDue')}</dt>
                <dd className="tabular">{l.nextDue ? `${f.date(l.nextDue.dueOn)} · ${t(`labels.rentStatus.${l.nextDue.status}`)}` : '—'}</dd>
              </div>
            </dl>
            {l.openMaintenance > 0 && (
              <div className="flex items-center gap-1.5 text-small text-muted">
                <Wrench className="size-4" strokeWidth={1.5} aria-hidden />
                {t('openRequests', { n: l.openMaintenance })}
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AddLeaseDialog({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations('property.add');
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const { data: listings } = useSWR<ListingCard[]>(open ? '/listings/mine' : null, fetcher);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = React.useState({ listingId: '', tenantName: '', tenantPhone: '', rent: '', dayOfMonth: '1', startsOn: today, endsOn: '', penalty: '0.1', autopay: false });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/property/leases', {
        method: 'POST',
        body: {
          listingId: f.listingId,
          tenantName: f.tenantName,
          tenantPhone: f.tenantPhone || null,
          rentMinor: Math.round(Number(f.rent.replace(/\s/g, '').replace(',', '.')) * 100),
          dayOfMonth: Number(f.dayOfMonth),
          startsOn: f.startsOn,
          endsOn: f.endsOn || null,
          penaltyPctPerDay: Number(f.penalty.replace(',', '.')),
          autopay: f.autopay,
        },
      });
      toast({ title: t('created'), tone: 'success' });
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ClientApiError ? (err.problem?.errors?.map((x) => x.message).join('; ') || err.message) : t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} size="lg" title={t('title')} description={t('description')} trigger={<Button icon={<Plus className="size-4" strokeWidth={1.5} aria-hidden />}>{t('title')}</Button>}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={t('listing')} required className="sm:col-span-2">
          <Select value={f.listingId} onChange={set('listingId')} required placeholder={listings ? t('chooseListing') : t('loading')} options={(listings ?? []).map((l) => ({ value: l.id, label: `${l.title} — ${l.address}` }))} />
        </Field>
        <Field label={t('tenantName')} required>
          <Input value={f.tenantName} onChange={set('tenantName')} required minLength={2} />
        </Field>
        <Field label={t('tenantPhone')} hint={t('tenantPhoneHint')}>
          <Input value={f.tenantPhone} onChange={set('tenantPhone')} inputMode="tel" placeholder="+9955…" />
        </Field>
        <Field label={t('rent')} required>
          <Input value={f.rent} onChange={set('rent')} inputMode="decimal" suffix="₾" required />
        </Field>
        <Field label={t('dayOfMonth')}>
          <Input type="number" min={1} max={28} value={f.dayOfMonth} onChange={set('dayOfMonth')} />
        </Field>
        <Field label={t('startsOn')} required>
          <Input type="date" value={f.startsOn} onChange={set('startsOn')} required />
        </Field>
        <Field label={t('endsOn')}>
          <Input type="date" value={f.endsOn} onChange={set('endsOn')} />
        </Field>
        <Field label={t('penalty')} hint={t('penaltyHint')}>
          <Input inputMode="decimal" value={f.penalty} onChange={set('penalty')} suffix="%" />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox checked={f.autopay} onCheckedChange={(c) => setF((s) => ({ ...s, autopay: c === true }))} label={t('autopay')} />
        </div>
        {error && (
          <p role="alert" className="text-small text-danger sm:col-span-2">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy} className="sm:col-span-2" disabled={!f.listingId || !f.tenantName || !f.rent}>
          {t('submit')}
        </Button>
      </form>
    </Dialog>
  );
}
