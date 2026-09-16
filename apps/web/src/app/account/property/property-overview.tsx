'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ArrowUpRight, Building2, CalendarClock, CircleDollarSign, Plus, Repeat, TrendingUp, Wallet, Wrench } from 'lucide-react';
import { type ListingCard, type LeaseDto, type PropertyOverview } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Avatar, Badge, Button, Checkbox, cn, Dialog, EmptyState, Field, Input, Select, Skeleton, useToast, type BadgeTone } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';

const DUE_TONE: Record<string, BadgeTone> = { paid: 'success', open: 'neutral', overdue: 'danger' };

export function PropertyOverviewView() {
  const t = useTranslations('property');
  const f = useFormat();
  const { data, mutate, error } = useSWR<PropertyOverview>('/property/overview', fetcher);
  if (error)
    return (
      <p role="alert" className="mt-6 flex items-center gap-2 rounded-card bg-danger/10 px-4 py-3 text-danger">
        <AlertTriangle className="size-5 shrink-0" strokeWidth={2} aria-hidden />
        {t('loadError')}
      </p>
    );
  if (!data)
    return (
      <div className="mt-8 flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-card" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      </div>
    );
  const owned = data.leases.filter((l) => l.myRole === 'owner');
  const rented = data.leases.filter((l) => l.myRole === 'tenant');
  const tot = data.totals;
  const collectedPct = tot.monthlyRentMinor ? Math.min(100, Math.round((tot.collectedThisMonthMinor / tot.monthlyRentMinor) * 100)) : 0;

  return (
    <div className="mt-8 flex min-w-0 flex-col gap-12 [&>*]:min-w-0">
      {owned.length > 0 && (
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="card col-span-2 flex flex-col overflow-hidden p-5 lg:col-span-1">
            <dt className="flex items-center justify-between gap-2 text-small font-medium text-muted">
              {t('totals.monthly')}
              <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary-soft-text">
                <Wallet className="size-4" strokeWidth={2} aria-hidden />
              </span>
            </dt>
            <dd className="mt-2 text-[28px] font-bold leading-tight tracking-tight tabular">{f.money(tot.monthlyRentMinor)}</dd>
          </div>
          <div className="card col-span-2 flex flex-col p-5 lg:col-span-1">
            <dt className="flex items-center justify-between gap-2 text-small font-medium text-muted">
              {t('totals.collected')}
              <span className="grid size-9 place-items-center rounded-xl bg-success/12 text-success">
                <TrendingUp className="size-4" strokeWidth={2} aria-hidden />
              </span>
            </dt>
            <dd className="mt-2 text-[28px] font-bold leading-tight tracking-tight tabular">{f.money(tot.collectedThisMonthMinor)}</dd>
            <dd className="mt-3 flex items-center gap-2 text-small text-muted">
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <span className="block h-full rounded-full bg-gradient-to-r from-primary-500 to-success" style={{ width: `${Math.max(collectedPct, 2)}%` }} />
              </span>
              <span className="font-semibold tabular text-text">{collectedPct}%</span>
            </dd>
          </div>
          <div className={cn('card flex flex-col p-5', tot.overdueMinor > 0 && 'border-danger/40 bg-[color-mix(in_srgb,var(--danger)_5%,var(--surface))]')}>
            <dt className="flex items-center justify-between gap-2 text-small font-medium text-muted">
              {t('totals.overdue')}
              <span className={cn('grid size-9 place-items-center rounded-xl', tot.overdueMinor ? 'bg-danger/10 text-danger' : 'bg-surface-2 text-muted')}>
                <CircleDollarSign className="size-4" strokeWidth={2} aria-hidden />
              </span>
            </dt>
            <dd className={cn('mt-2 text-[24px] font-bold leading-tight tracking-tight tabular md:text-[28px]', tot.overdueMinor && 'text-danger')}>{f.money(tot.overdueMinor)}</dd>
          </div>
          <div className="card flex flex-col p-5">
            <dt className="flex items-center justify-between gap-2 text-small font-medium text-muted">
              {t('totals.maintenance')}
              <span className={cn('grid size-9 place-items-center rounded-xl', tot.openMaintenance ? 'bg-accent-soft text-[#7a5200] dark:text-accent' : 'bg-surface-2 text-muted')}>
                <Wrench className="size-4" strokeWidth={2} aria-hidden />
              </span>
            </dt>
            <dd className="mt-2 text-[24px] font-bold leading-tight tracking-tight tabular md:text-[28px]">{f.number(tot.openMaintenance)}</dd>
          </div>
        </dl>
      )}

      <section aria-labelledby="owned">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-text">
              <Building2 className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <h2 id="owned" className="text-[22px] font-bold leading-tight tracking-tight md:text-[24px]">
              {t('portfolio')}
            </h2>
            {owned.length > 0 && <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-small font-semibold tabular text-muted">{owned.length}</span>}
          </div>
          <AddLeaseDialog onCreated={() => mutate()} />
        </div>
        {!owned.length ? <EmptyState className="mt-5" icon={<Building2 className="size-6" strokeWidth={2} aria-hidden />} title={t('noOwned')} description={t('noOwnedText')} /> : <LeaseGrid leases={owned} />}
      </section>

      {rented.length > 0 && (
        <section aria-labelledby="rented">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-link/10 text-link">
              <Repeat className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <h2 id="rented" className="text-[22px] font-bold leading-tight tracking-tight md:text-[24px]">
              {t('myLeases')}
            </h2>
          </div>
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
    <ul className="mt-5 grid gap-5 md:grid-cols-2">
      {leases.map((l) => {
        const counterpart = l.myRole === 'owner' ? l.tenantName : (l.ownerName ?? '—');
        const owes = l.balanceDueMinor > 0;
        return (
          <li key={l.id} className="min-w-0">
            <Link href={`/account/property/leases/${l.id}`} className="group card card-hover flex h-full flex-col overflow-hidden focus-visible:shadow-ring focus-visible:outline-none">
              <div className="relative h-36 overflow-hidden bg-surface-2">
                {l.listing.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.listing.cover} alt="" className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]" />
                ) : (
                  <div className="drawing-grid grid size-full place-items-center text-muted" aria-hidden>
                    <Building2 className="size-8" strokeWidth={1.5} />
                  </div>
                )}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                  <Badge tone={l.myRole === 'owner' ? 'primary' : 'link'} className="bg-surface/95 shadow-xs backdrop-blur">
                    {l.myRole === 'owner' ? t('roleOwner') : t('roleTenant')}
                  </Badge>
                  {l.status === 'ended' && <Badge tone="neutral" className="shadow-xs">{t('ended')}</Badge>}
                  {l.autopay && <Badge tone="success" className="bg-surface/95 shadow-xs">{t('autopay')}</Badge>}
                </div>
                <div className="absolute inset-x-4 bottom-3 text-white">
                  <div className="truncate text-[17px] font-bold drop-shadow-sm">{l.listing.title}</div>
                  <div className="truncate text-small text-white/85">{l.listing.address}</div>
                </div>
                <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-surface/95 text-text opacity-0 shadow-xs transition-opacity group-hover:opacity-100" aria-hidden>
                  <ArrowUpRight className="size-4" strokeWidth={2} />
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center gap-3">
                  <Avatar name={counterpart.replace(/[„“"«»]/g, "")} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-small text-muted">{l.myRole === 'owner' ? t('tenant') : t('owner')}</div>
                    <div className="truncate font-semibold">{counterpart}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-small text-muted">{t('rentAmount')}</div>
                    <div className="font-bold tabular">{f.money(l.rentMinor)}</div>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div className={cn('rounded-2xl px-3.5 py-2.5', owes ? 'bg-danger/10' : 'bg-surface-2')}>
                    <dt className={cn('text-small', owes ? 'text-danger' : 'text-muted')}>{t('balance')}</dt>
                    <dd className={cn('text-[18px] font-bold tabular', owes && 'text-danger')}>{f.money(l.balanceDueMinor)}</dd>
                  </div>
                  <div className="rounded-2xl bg-surface-2 px-3.5 py-2.5">
                    <dt className="flex items-center gap-1.5 text-small text-muted">
                      <CalendarClock className="size-3.5" strokeWidth={2} aria-hidden />
                      {t('nextDue')}
                    </dt>
                    <dd className="font-semibold tabular">{l.nextDue ? f.date(l.nextDue.dueOn) : '—'}</dd>
                  </div>
                </dl>
                {(l.nextDue || l.openMaintenance > 0) && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                    {l.nextDue && <Badge tone={DUE_TONE[l.nextDue.status] ?? 'neutral'}>{t(`labels.rentStatus.${l.nextDue.status}`)}</Badge>}
                    {l.openMaintenance > 0 && (
                      <Badge tone="accent" icon={<Wrench className="size-3.5" strokeWidth={2} aria-hidden />}>
                        {t('openRequests', { n: l.openMaintenance })}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </Link>
          </li>
        );
      })}
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
    <Dialog open={open} onOpenChange={setOpen} size="lg" title={t('title')} description={t('description')} trigger={<Button icon={<Plus className="size-4" strokeWidth={2} aria-hidden />}>{t('title')}</Button>}>
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
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-small text-danger sm:col-span-2">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={busy} className="sm:col-span-2" disabled={!f.listingId || !f.tenantName || !f.rent}>
          {t('submit')}
        </Button>
      </form>
    </Dialog>
  );
}
