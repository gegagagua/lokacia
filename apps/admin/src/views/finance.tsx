'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { FINANCE_KIND_LABELS_KA, FINANCE_STATUS_LABELS_KA, formatDateKa, formatMoney, type FinanceApplicationDto, type FinanceProductDto } from '@lokacia/contracts';
import { Badge, Button, Dialog, EmptyState, Field, Input, Select, Switch, Tabs, Textarea } from '@lokacia/ui';
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
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button
          size="sm"
          icon={<Plus className="size-4" strokeWidth={1.5} aria-hidden />}
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
        >
          {t('newProduct')}
        </Button>
      </div>
      {data.length === 0 ? (
        <EmptyState title={t('noProducts')} />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[760px] border-collapse text-left text-[14px] tabular">
            <thead>
              <tr className="border-b border-border-strong text-small text-muted">
                <th scope="col" className="px-3 py-2 font-medium">{t('name')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('kind')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('rateText')}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t('range')}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t('commissionPct')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('state')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-left font-medium text-link hover:underline"
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                    >
                      {p.name}
                    </button>
                    <div className="text-small text-muted">{p.partner}</div>
                  </td>
                  <td className="px-3 py-2">{FINANCE_KIND_LABELS_KA[p.kind]}</td>
                  <td className="px-3 py-2 text-small">{p.rateText ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-small">
                    {p.minAmountMinor != null ? formatMoney(p.minAmountMinor) : '—'} – {p.maxAmountMinor != null ? formatMoney(p.maxAmountMinor) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">{p.commissionPct}%</td>
                  <td className="px-3 py-2">{p.active ? <Badge tone="success">{t('active')}</Badge> : <Badge>{t('inactive')}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
  if (!data.length) return <EmptyState title={t('noApplications')} />;
  const simulate = async (a: FinanceApplicationDto, status: 'approved' | 'rejected', approvedAmountMinor?: number) => {
    if (await run(() => apiFetch(`/admin/finance/applications/${a.id}/simulate`, { method: 'POST', body: { status, approvedAmountMinor } }), status === 'approved' ? t('simApproved') : t('simRejected'))) {
      setTarget(null);
      await mutate();
    }
  };
  const total = data.reduce((s, a) => s + (a.commissionMinor ?? 0), 0);
  return (
    <>
      <p className="mb-3 text-small text-muted">
        {t('commissionTotal')}: <span className="font-medium text-text tabular">{formatMoney(total)}</span>
      </p>
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[860px] border-collapse text-left text-[14px] tabular">
          <thead>
            <tr className="border-b border-border-strong text-small text-muted">
              <th scope="col" className="px-3 py-2 font-medium">{t('applicant')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('product')}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t('amount')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('status')}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t('commission')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('date')}</th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">{t('actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id} className="border-b border-border align-top last:border-b-0">
                <td className="px-3 py-2">
                  {a.applicant ? (
                    <Link href={`/users/${a.applicant.id}`} className="text-link hover:underline">
                      {a.applicant.name ?? a.applicant.phone}
                    </Link>
                  ) : (
                    '—'
                  )}
                  {a.listing && <div className="max-w-[220px] truncate text-small text-muted">{a.listing.title}</div>}
                </td>
                <td className="px-3 py-2">
                  {a.product.name}
                  <div className="text-small text-muted">
                    {a.product.partner} · {FINANCE_KIND_LABELS_KA[a.product.kind]}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  {formatMoney(a.amountMinor)}
                  {a.termMonths && <div className="text-small text-muted">{t('months', { count: a.termMonths })}</div>}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={a.status === 'approved' ? 'success' : a.status === 'rejected' ? 'danger' : 'accent'}>{FINANCE_STATUS_LABELS_KA[a.status]}</Badge>
                  {a.partnerRef && <div className="font-mono text-[11px] text-muted">{a.partnerRef}</div>}
                </td>
                <td className="px-3 py-2 text-right">{a.commissionMinor != null ? formatMoney(a.commissionMinor) : '—'}</td>
                <td className="px-3 py-2 text-small text-muted">{formatDateKa(a.createdAt)}</td>
                <td className="px-3 py-2 text-right">
                  {(a.status === 'submitted' || a.status === 'sent') && (
                    <div className="flex justify-end gap-1">
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
                      <Button size="sm" variant="ghost" loading={busy} onClick={() => simulate(a, 'rejected')}>
                        {t('simReject')}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Tabs
        tabs={[
          { value: 'products', label: t('tabProducts'), content: <Products /> },
          { value: 'applications', label: t('tabApplications'), content: <Applications /> },
        ]}
      />
    </>
  );
}
