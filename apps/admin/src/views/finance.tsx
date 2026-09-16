'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Coins, FileText, Landmark, Pencil, Plus } from 'lucide-react';
import { FINANCE_KIND_LABELS_KA, FINANCE_STATUS_LABELS_KA, formatDateKa, formatMoney, type FinanceApplicationDto, type FinanceProductDto } from '@lokacia/contracts';
import { Button, Dialog, EmptyState, Field, Input, Select, Switch, Tabs, Textarea, cn } from '@lokacia/ui';
import { KpiCard, Person, StatusPill, TableCard, THead, td, th, tr } from '@/components/kit';
import { OrgMark } from './orgs';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';

type Kind = FinanceProductDto['kind'];
type Draft = { partner: string; kind: Kind; name: string; description: string; rateText: string; minGel: string; maxGel: string; commissionPct: string; active: boolean };
const toDraft = (p?: FinanceProductDto): Draft => ({
  partner: p?.partner ?? '',
  kind: p?.kind ?? 'fitout_loan',
  name: p?.name ?? '',
  description: p?.description ?? '',
  rateText: p?.rateText ?? '',
  minGel: p?.minAmountMinor != null ? String(p.minAmountMinor / 100) : '',
  maxGel: p?.maxAmountMinor != null ? String(p.maxAmountMinor / 100) : '',
  commissionPct: p ? String(p.commissionPct) : '1',
  active: p?.active ?? true,
});
const gel = (s: string) => (s.trim() === '' ? null : Math.round(Number(s.replace(',', '.')) * 100));

function ProductDialog({ product, open, onOpenChange, onDone }: { product?: FinanceProductDto; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const t = useTranslations('finance');
  const [d, setD] = React.useState<Draft>(toDraft(product));
  const { run, busy } = useAction();
  React.useEffect(() => {
    if (open) setD(toDraft(product));
  }, [open, product]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { partner: d.partner, kind: d.kind, name: d.name, description: d.description, rateText: d.rateText || null, minAmountMinor: gel(d.minGel), maxAmountMinor: gel(d.maxGel), commissionPct: Number(d.commissionPct.replace(',', '.')), active: d.active };
    const ok = await run(() => apiFetch(product ? `/admin/finance/products/${product.id}` : '/admin/finance/products', { method: product ? 'PATCH' : 'POST', body }), t('productSaved'));
    if (ok) {
      onOpenChange(false);
      onDone();
    }
  };
  const remove = async () => {
    if (!product || !window.confirm(t('confirmDelete'))) return;
    if (await run(() => apiFetch(`/admin/finance/products/${product.id}`, { method: 'DELETE' }), t('productDeleted'))) {
      onOpenChange(false);
      onDone();
    }
  };
  const formId = React.useId();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={product ? t('editProduct') : t('newProduct')}
      footer={
        <>
          {product && (
            <Button variant="danger" className="mr-auto" onClick={remove}>
              {t('deleteProduct')}
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {t('saveProduct')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <Field label={t('partner')} required>
          <Input value={d.partner} onChange={(e) => set('partner', e.target.value)} required />
        </Field>
        <Field label={t('kind')}>
          <Select value={d.kind} onChange={(e) => set('kind', e.target.value as Kind)} options={Object.entries(FINANCE_KIND_LABELS_KA).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Field label={t('name')} required className="md:col-span-2">
          <Input value={d.name} onChange={(e) => set('name', e.target.value)} required />
        </Field>
        <Field label={t('description')} required className="md:col-span-2">
          <Textarea rows={3} value={d.description} onChange={(e) => set('description', e.target.value)} required />
        </Field>
        <Field label={t('rateText')}>
          <Input value={d.rateText} onChange={(e) => set('rateText', e.target.value)} />
        </Field>
        <Field label={t('commissionPct')} required>
          <Input inputMode="decimal" value={d.commissionPct} onChange={(e) => set('commissionPct', e.target.value)} suffix="%" className="tabular" required />
        </Field>
        <Field label={t('minAmount')}>
          <Input inputMode="decimal" value={d.minGel} onChange={(e) => set('minGel', e.target.value)} suffix="₾" className="tabular" />
        </Field>
        <Field label={t('maxAmount')}>
          <Input inputMode="decimal" value={d.maxGel} onChange={(e) => set('maxGel', e.target.value)} suffix="₾" className="tabular" />
        </Field>
        <div className="md:col-span-2">
          <Switch label={t('active')} checked={d.active} onCheckedChange={(v) => set('active', v)} />
        </div>
      </form>
    </Dialog>
  );
}

function Products() {
  const t = useTranslations('finance');
  const { data, error, mutate } = useSWR<FinanceProductDto[]>('/admin/finance/products', fetcher);
  const [editing, setEditing] = React.useState<FinanceProductDto | undefined>();
  const [open, setOpen] = React.useState(false);
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock />;
  const openNew = () => {
    setEditing(undefined);
    setOpen(true);
  };
  return (
    <>
      {data.length === 0 ? (
        <EmptyState title={t('noProducts')} icon={<Landmark className="size-6" strokeWidth={2} aria-hidden />} action={<Button onClick={openNew} icon={<Plus className="size-4" strokeWidth={2} aria-hidden />}>{t('newProduct')}</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.map((p) => (
            <article key={p.id} className={cn('card card-hover flex min-w-0 flex-col overflow-hidden', !p.active && 'opacity-75')}>
              <div className="flex items-start gap-3 p-5">
                <OrgMark name={p.partner} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-muted">{p.partner}</div>
                  <h3 className="text-[17px] font-bold leading-snug">{p.name}</h3>
                </div>
                {p.active ? <StatusPill tone="success">{t('active')}</StatusPill> : <StatusPill>{t('inactive')}</StatusPill>}
              </div>
              <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[12.5px] font-semibold text-primary-soft-text">{FINANCE_KIND_LABELS_KA[p.kind]}</span>
                </div>
                <p className="line-clamp-3 text-[14.5px] text-muted">{p.description}</p>
                <dl className="mt-auto grid grid-cols-3 gap-2">
                  <div className="col-span-3 rounded-xl bg-accent-soft px-3 py-2.5">
                    <dt className="text-[12px] font-medium text-[#7a5500] dark:text-accent">{t('rateText')}</dt>
                    <dd className="font-bold tabular">{p.rateText ?? '—'}</dd>
                  </div>
                  <div className="col-span-2 min-w-0 rounded-xl bg-surface-2/70 px-3 py-2.5">
                    <dt className="text-[12px] font-medium text-muted">{t('range')}</dt>
                    <dd className="truncate text-[14px] font-semibold tabular">
                      {p.minAmountMinor == null && p.maxAmountMinor == null ? '—' : `${p.minAmountMinor != null ? formatMoney(p.minAmountMinor) : '—'} – ${p.maxAmountMinor != null ? formatMoney(p.maxAmountMinor) : '—'}`}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-surface-2/70 px-3 py-2.5">
                    <dt className="text-[12px] font-medium text-muted">{t('commissionPct')}</dt>
                    <dd className="text-[14px] font-semibold tabular">{p.commissionPct}%</dd>
                  </div>
                </dl>
              </div>
              <div className="border-t border-border bg-surface-2/40 px-5 py-3">
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  icon={<Pencil className="size-4" strokeWidth={2} aria-hidden />}
                  aria-label={`${t('editProduct')}: ${p.name}`}
                  onClick={() => {
                    setEditing(p);
                    setOpen(true);
                  }}
                >
                  {t('editProduct')}
                </Button>
              </div>
            </article>
          ))}
          <button
            type="button"
            onClick={openNew}
            className="grid min-h-64 place-items-center rounded-card border-2 border-dashed border-border-strong p-6 text-muted transition-colors hover:border-primary hover:bg-primary-soft/40 hover:text-primary-soft-text focus-visible:shadow-ring focus-visible:outline-none"
          >
            <span className="flex flex-col items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-surface-2">
                <Plus className="size-6" strokeWidth={2} aria-hidden />
              </span>
              <span className="font-semibold">{t('newProduct')}</span>
            </span>
          </button>
        </div>
      )}
      <ProductDialog product={editing} open={open} onOpenChange={setOpen} onDone={() => mutate()} />
    </>
  );
}

function Applications() {
  const t = useTranslations('finance');
  const { data, error, mutate } = useSWR<FinanceApplicationDto[]>('/admin/finance/applications', fetcher);
  const { run, busy } = useAction();
  const [target, setTarget] = React.useState<FinanceApplicationDto | null>(null);
  const [amount, setAmount] = React.useState('');
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock />;
  if (!data.length) return <EmptyState title={t('noApplications')} icon={<FileText className="size-6" strokeWidth={2} aria-hidden />} />;
  const simulate = async (a: FinanceApplicationDto, status: 'approved' | 'rejected', approvedAmountMinor?: number) => {
    if (await run(() => apiFetch(`/admin/finance/applications/${a.id}/simulate`, { method: 'POST', body: { status, approvedAmountMinor } }), status === 'approved' ? t('simApproved') : t('simRejected'))) {
      setTarget(null);
      await mutate();
    }
  };
  const total = data.reduce((s, a) => s + (a.commissionMinor ?? 0), 0);
  const approvedCount = data.filter((a) => a.status === 'approved').length;
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <KpiCard label={t('commissionTotal')} value={formatMoney(total)} icon={Coins} tone="accent" className="col-span-2 lg:col-span-1" />
        <KpiCard label={t('tabApplications')} value={data.length} icon={FileText} tone="info" />
        <KpiCard label={FINANCE_STATUS_LABELS_KA.approved} value={approvedCount} icon={CheckCircle2} tone="success" />
      </div>
      <TableCard minWidth={940} label={t('tabApplications')}>
        <THead>
          <th scope="col" className={th}>{t('applicant')}</th>
          <th scope="col" className={th}>{t('product')}</th>
          <th scope="col" className={`${th} text-right`}>{t('amount')}</th>
          <th scope="col" className={th}>{t('status')}</th>
          <th scope="col" className={`${th} text-right`}>{t('commission')}</th>
          <th scope="col" className={th}>{t('date')}</th>
          <th scope="col" className={th}>
            <span className="sr-only">{t('actions')}</span>
          </th>
        </THead>
        <tbody>
          {data.map((a) => (
            <tr key={a.id} className={tr}>
              <td className={td}>
                {a.applicant ? <Person name={a.applicant.name ?? a.applicant.phone} href={`/users/${a.applicant.id}`} sub={a.listing?.title} size={34} className="max-w-[260px]" /> : '—'}
              </td>
              <td className={td}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <OrgMark name={a.product.partner} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{a.product.name}</div>
                    <div className="truncate text-small text-muted">
                      {a.product.partner} · {FINANCE_KIND_LABELS_KA[a.product.kind]}
                    </div>
                  </div>
                </div>
              </td>
              <td className={`${td} text-right`}>
                <div className="font-bold">{formatMoney(a.amountMinor)}</div>
                {a.termMonths && <div className="text-small text-muted">{t('months', { count: a.termMonths })}</div>}
              </td>
              <td className={td}>
                <StatusPill tone={a.status === 'approved' ? 'success' : a.status === 'rejected' ? 'danger' : 'accent'}>{FINANCE_STATUS_LABELS_KA[a.status]}</StatusPill>
                {a.partnerRef && <div className="mt-1 font-mono text-[11.5px] text-muted">{a.partnerRef}</div>}
              </td>
              <td className={`${td} text-right font-semibold`}>{a.commissionMinor != null ? formatMoney(a.commissionMinor) : '—'}</td>
              <td className={`${td} text-muted`}>{formatDateKa(a.createdAt)}</td>
              <td className={`${td} text-right`}>
                {(a.status === 'submitted' || a.status === 'sent') && (
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="ghost" loading={busy} onClick={() => simulate(a, 'rejected')}>
                      {t('simReject')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setTarget(a);
                        setAmount(String(a.amountMinor / 100));
                      }}
                    >
                      {t('simApprove')}
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      <Dialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={t('simApproveTitle')}
        description={t('simHint')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              {t('cancel')}
            </Button>
            <Button loading={busy} onClick={() => target && simulate(target, 'approved', gel(amount) ?? undefined)}>
              {t('simApprove')}
            </Button>
          </>
        }
      >
        <Field label={t('approvedAmount')}>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} suffix="₾" className="tabular" />
        </Field>
      </Dialog>
    </>
  );
}

export function FinanceView() {
  const t = useTranslations('finance');
  return (
    <>
      <PageHeader icon={Landmark} title={t('title')} subtitle={t('subtitle')} />
      <Tabs
        tabs={[
          { value: 'products', label: t('tabProducts'), content: <Products /> },
          { value: 'applications', label: t('tabApplications'), content: <Applications /> },
        ]}
      />
    </>
  );
}
