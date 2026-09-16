'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Copy, File, FileBadge, FileCheck2, FileDown, FilePlus2, FileSignature, Files, FileText, LayoutGrid, Link2, List, PenLine, Send, Trash2, type LucideIcon } from 'lucide-react';
import { DOCUMENT_TEMPLATE_LABELS_KA, DOCUMENT_TEMPLATES, formatDateKa, SIGN_STATUS_LABELS_KA, type CrmDocument } from '@lokacia/contracts';
import { Button, Dialog, Drawer, EmptyState, Field, Input, Select, Skeleton, Table, Textarea, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { ContactPicker } from '@/components/common/pickers';
import { ChipGroup, IconTile, PersonAvatar, Pill, Segmented, StatCard, toneClass, type Tone } from '@/components/common/ui';
import { downloadFile, errorMessage } from '@/lib/api-client';
import { Can } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import { SIGN_STATUS_TONE, SignStatusBadge } from './status-badge';

type DocDetail = CrmDocument & { versions: { id: string; version: number; signStatus: CrmDocument['signStatus']; createdAt: string }[] };
type DealOption = { id: string; title: string };

const TEMPLATE_META: Record<CrmDocument['template'], { icon: LucideIcon; tone: Tone }> = {
  exclusivity: { icon: FileBadge, tone: 4 },
  act: { icon: FileCheck2, tone: 1 },
  lease: { icon: FileText, tone: 2 },
  custom: { icon: File, tone: 8 },
};
const VIEW_KEY = 'lk-crm-documents-view';
type StatusFilter = '' | CrmDocument['signStatus'];

export function DocumentsView() {
  const t = useTranslations('documents');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const dealId = params.get('dealId');
  const contactId = params.get('contactId');
  const qs = new URLSearchParams();
  if (dealId) qs.set('dealId', dealId);
  if (contactId) qs.set('contactId', contactId);
  const { data, isLoading, mutate } = useApi<CrmDocument[]>(`/crm/documents${qs.size ? `?${qs}` : ''}`);
  const openId = params.get('id');
  const [status, setStatus] = React.useState<StatusFilter>('');
  const [view, setView] = React.useState<'cards' | 'table'>('cards');
  React.useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === 'cards' || v === 'table') setView(v);
    } catch {
      /* private mode */
    }
  }, []);
  const changeView = (v: 'cards' | 'table') => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* private mode */
    }
  };
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(`${pathname}${p.size ? `?${p}` : ''}`, { scroll: false });
  };
  const count = (st: CrmDocument['signStatus']) => (data ?? []).filter((d) => d.signStatus === st).length;
  const rows = React.useMemo(() => (data ?? []).filter((d) => !status || d.signStatus === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data, status]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        className="mb-0"
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button size="sm" icon={<FilePlus2 className="size-4" strokeWidth={2} />} onClick={() => setParam('new', '1')}>
            {t('new')}
          </Button>
        }
      />
      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard label={t('kpi.total')} value={data.length} icon={Files} tone={2} />
          <StatCard label={SIGN_STATUS_LABELS_KA.draft} value={count('draft')} icon={PenLine} tone={8} />
          <StatCard label={SIGN_STATUS_LABELS_KA.sent} value={count('sent')} icon={Send} tone={3} />
          <StatCard label={SIGN_STATUS_LABELS_KA.signed} value={count('signed')} icon={FileCheck2} tone="success" />
        </div>
      )}
      {data && data.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ChipGroup
            label={t('cols.status')}
            value={status}
            onChange={setStatus}
            className="min-w-0 flex-1"
            options={[{ value: '' as StatusFilter, label: t('kpi.all'), count: data.length }, ...(['draft', 'sent', 'signed', 'declined'] as const).map((st) => ({ value: st as StatusFilter, label: SIGN_STATUS_LABELS_KA[st], count: count(st), tone: SIGN_STATUS_TONE[st] }))]}
          />
          <Segmented
            label={t('kpi.view')}
            value={view}
            onChange={changeView}
            className="self-start sm:self-auto"
            options={[
              { value: 'cards', label: t('kpi.cards'), icon: LayoutGrid },
              { value: 'table', label: t('kpi.table'), icon: List },
            ]}
          />
        </div>
      )}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-card" />
          ))}
        </div>
      )}
      {data && data.length === 0 && <EmptyState icon={<FileSignature className="size-6" strokeWidth={2} aria-hidden />} title={t('empty')} description={t('emptyHint')} action={<Button onClick={() => setParam('new', '1')}>{t('new')}</Button>} />}
      {data && data.length > 0 && view === 'cards' && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={t('title')}>
          {rows.map((r) => {
            const meta = TEMPLATE_META[r.template] ?? TEMPLATE_META.custom;
            const person = r.contactName ?? r.dealTitle;
            return (
              <li key={r.id} className="card card-hover relative flex flex-col gap-4 p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <span className={`relative grid h-14 w-12 shrink-0 place-items-center rounded-xl rounded-tr-[18px] bg-tone-soft text-tone-ink ${toneClass(meta.tone)}`} aria-hidden>
                    <meta.icon className="size-6" strokeWidth={1.8} />
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-md bg-tone px-1.5 text-[9.5px] font-bold uppercase leading-4 tracking-wide text-white">PDF</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setParam('id', r.id)} className="line-clamp-2 text-left text-[15px] font-semibold leading-5 after:absolute after:inset-0 after:rounded-card after:content-[''] hover:text-primary-soft-text focus-visible:outline-none focus-visible:after:shadow-ring">
                      {r.title}
                    </button>
                    {r.title !== DOCUMENT_TEMPLATE_LABELS_KA[r.template] && <div className="mt-1 line-clamp-1 text-[12.5px] text-muted">{DOCUMENT_TEMPLATE_LABELS_KA[r.template]}</div>}
                  </div>
                  <Pill tone="neutral" size="sm">
                    v{r.version}
                  </Pill>
                </div>
                {(r.dealTitle || r.contactName) && (
                  <div className="flex items-center gap-2.5 rounded-2xl bg-surface-2 p-2.5">
                    <PersonAvatar name={person} size={30} />
                    <div className="min-w-0 text-[13px] leading-4">
                      {r.dealTitle && <div className="truncate font-semibold">{r.dealTitle}</div>}
                      {r.contactName && <div className="truncate text-muted">{r.contactName}</div>}
                    </div>
                  </div>
                )}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                  <SignStatusBadge status={r.signStatus} />
                  <span className="whitespace-nowrap text-[12.5px] text-muted tabular">{formatDateKa(r.signedAt ?? r.createdAt)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {data && data.length > 0 && view === 'table' && (
        <Table
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => setParam('id', r.id)}
          initialSort={{ key: 'created', dir: 'desc' }}
          columns={[
            {
              key: 'title',
              header: t('cols.title'),
              sortValue: (r) => r.title,
              cell: (r) => {
                const meta = TEMPLATE_META[r.template] ?? TEMPLATE_META.custom;
                return (
                  <div className="flex min-w-[220px] items-center gap-3">
                    <IconTile icon={meta.icon} tone={meta.tone} size="sm" />
                    <div className="min-w-0">
                      <div className="font-semibold">{r.title}</div>
                      {r.title !== DOCUMENT_TEMPLATE_LABELS_KA[r.template] && <div className="text-[13px] text-muted">{DOCUMENT_TEMPLATE_LABELS_KA[r.template]}</div>}
                    </div>
                  </div>
                );
              },
            },
            {
              key: 'related',
              header: t('cols.related'),
              cell: (r) => (
                <div className="text-[13.5px]">
                  {r.dealTitle && <div>{r.dealTitle}</div>}
                  {r.contactName && <div className="text-muted">{r.contactName}</div>}
                </div>
              ),
            },
            { key: 'version', header: t('cols.version'), align: 'right', sortValue: (r) => r.version, cell: (r) => <span className="tabular">v{r.version}</span> },
            { key: 'status', header: t('cols.status'), sortValue: (r) => r.signStatus, cell: (r) => <SignStatusBadge status={r.signStatus} /> },
            { key: 'created', header: t('cols.created'), sortValue: (r) => r.createdAt, cell: (r) => <span className="text-[13px] text-muted tabular">{formatDateKa(r.createdAt)}</span> },
          ]}
        />
      )}
      {params.get('new') === '1' && (
        <CreateDocumentDialog
          dealId={dealId}
          contactId={contactId}
          onClose={() => setParam('new', null)}
          onCreated={async (id) => {
            await mutate();
            const p = new URLSearchParams(params.toString());
            p.delete('new');
            p.set('id', id);
            router.replace(`${pathname}?${p}`, { scroll: false });
          }}
        />
      )}
      {openId && (
        <DocumentDrawer
          id={openId}
          onClose={() => setParam('id', null)}
          onChanged={(id) => {
            void mutate();
            if (id !== openId) setParam('id', id);
          }}
        />
      )}
    </div>
  );
}

function CreateDocumentDialog({ dealId, contactId, onClose, onCreated }: { dealId: string | null; contactId: string | null; onClose: () => void; onCreated: (id: string) => void }) {
  const t = useTranslations('documents');
  const common = useTranslations('shell.common');
  const toast = useToast();
  const api = useApiMutation();
  const { data: board } = useApi<{ deals?: DealOption[] } | DealOption[]>('/crm/deals');
  const deals: DealOption[] = Array.isArray(board) ? board : (board?.deals ?? []);
  const [template, setTemplate] = React.useState<(typeof DOCUMENT_TEMPLATES)[number]>('exclusivity');
  const [deal, setDeal] = React.useState(dealId ?? '');
  const [contact, setContact] = React.useState<string | null>(contactId);
  const [title, setTitle] = React.useState('');
  const [term, setTerm] = React.useState('6');
  const [commission, setCommission] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const fields: Record<string, string | number> = { termMonths: Number(term) || 6 };
      if (commission) fields.commissionPct = Number(commission);
      const doc = await api<CrmDocument>('/crm/documents', { body: { template, dealId: deal || null, contactId: deal ? null : contact, title: title || null, fields } });
      onCreated(doc.id);
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('new')} footer={<><Button variant="ghost" onClick={onClose}>{common('cancel')}</Button><Button onClick={submit} loading={busy}>{t('form.create')}</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label={t('form.template')}>
          <Select value={template} onChange={(e) => setTemplate(e.target.value as typeof template)} options={DOCUMENT_TEMPLATES.map((k) => ({ value: k, label: DOCUMENT_TEMPLATE_LABELS_KA[k] }))} />
        </Field>
        <Field label={t('form.deal')}>
          <Select value={deal} onChange={(e) => setDeal(e.target.value)} placeholder="—" options={[...(dealId && !deals.some((d) => d.id === dealId) ? [{ value: dealId, label: dealId }] : []), ...deals.map((d) => ({ value: d.id, label: d.title }))]} />
        </Field>
        {!deal && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold">{t('form.contact')}</span>
            <ContactPicker value={contact} onChange={(id) => setContact(id)} />
          </div>
        )}
        <Field label={t('form.title')}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={DOCUMENT_TEMPLATE_LABELS_KA[template]} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('form.termMonths')}>
            <Input type="number" min={1} value={term} onChange={(e) => setTerm(e.target.value)} className="tabular" />
          </Field>
          <Field label={t('form.commissionPct')}>
            <Input type="number" min={0} max={100} step={0.5} value={commission} onChange={(e) => setCommission(e.target.value)} className="tabular" />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

function DocumentDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: (id: string) => void }) {
  const t = useTranslations('documents');
  const common = useTranslations('shell.common');
  const toast = useToast();
  const api = useApiMutation();
  const { data, mutate } = useApi<DocDetail>(`/crm/documents/${id}`);
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState('');
  const [sendOpen, setSendOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const latest = data && data.versions[data.versions.length - 1]?.id === data.id;
  const locked = data && (data.signStatus === 'sent' || data.signStatus === 'signed');

  const saveVersion = async () => {
    setBusy(true);
    try {
      const doc = await api<DocDetail>(`/crm/documents/${id}/versions`, { body: { text } });
      setEditing(false);
      onChanged(doc.id);
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title={data?.title ?? '…'} className="max-w-2xl">
      {!data ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface-2/60 p-3">
            <IconTile icon={(TEMPLATE_META[data.template] ?? TEMPLATE_META.custom).icon} tone={(TEMPLATE_META[data.template] ?? TEMPLATE_META.custom).tone} size="sm" />
            <span className="text-[13.5px] font-medium">{DOCUMENT_TEMPLATE_LABELS_KA[data.template]}</span>
            <SignStatusBadge status={data.signStatus} />
            {data.dealId && <Link className="text-small text-link hover:underline" href={`/deals/${data.dealId}`}>{data.dealTitle}</Link>}
            {data.contactId && <Link className="text-small text-link hover:underline" href={`/contacts/${data.contactId}`}>{data.contactName}</Link>}
          </div>
          <div>
            <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">{t('detail.versions')}</div>
            <div className="flex flex-wrap gap-1.5">
              {data.versions.map((v) => (
                <button key={v.id} type="button" onClick={() => onChanged(v.id)} aria-pressed={v.id === data.id} className={`h-8 rounded-full border px-3 text-[13px] font-semibold tabular transition-colors ${v.id === data.id ? 'border-transparent bg-text text-surface' : 'border-border bg-surface text-muted hover:text-text'}`}>
                  {t('detail.version', { n: v.version })}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<FileDown className="size-4" strokeWidth={2} />} onClick={() => downloadFile(`/crm/documents/${data.id}/pdf`, `${data.title}-v${data.version}.pdf`)}>
              {t('detail.pdf')}
            </Button>
            {latest && !locked && (
              <Button variant="secondary" size="sm" onClick={() => { setText(data.text); setEditing(true); }}>
                {t('detail.newVersion')}
              </Button>
            )}
            {latest && data.signStatus !== 'signed' && (
              <Can perm="documents.sign">
                <Button size="sm" icon={<Send className="size-4" strokeWidth={2} />} onClick={() => setSendOpen(true)}>
                  {t('detail.send')}
                </Button>
              </Can>
            )}
            {data.signStatus !== 'signed' && (
              <Can perm="records.delete">
                <Button variant="danger" size="sm" icon={<Trash2 className="size-4" strokeWidth={2} />} onClick={async () => { await api(`/crm/documents/${data.id}`, { method: 'DELETE' }); onChanged(data.id); onClose(); }}>
                  {t('detail.delete')}
                </Button>
              </Can>
            )}
          </div>
          {locked && <p className="rounded-xl bg-accent-soft px-3 py-2 text-[13px] text-text">{t('detail.locked')}</p>}
          {data.signUrl && (
            <div className="flex items-center gap-2 rounded-2xl border border-link/25 bg-link/5 p-2 pl-3">
              <Link2 className="size-4 shrink-0 text-link" strokeWidth={2} aria-hidden />
              <span className="sr-only">{t('detail.signLink')}:</span>
              <a href={data.signUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-small text-link">{data.signUrl}</a>
              <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" strokeWidth={2} />} onClick={() => { void navigator.clipboard.writeText(data.signUrl!); toast({ title: t('detail.copied') }); }}>
                {t('detail.copy')}
              </Button>
            </div>
          )}
          {editing ? (
            <div className="flex flex-col gap-2">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[50dvh] font-[inherit] text-[14px]" aria-label={t('detail.editText')} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(false)}>{common('cancel')}</Button>
                <Button onClick={saveVersion} loading={busy}>{t('detail.saveVersion')}</Button>
              </div>
            </div>
          ) : (
            <article className="whitespace-pre-wrap rounded-card border border-border bg-surface p-5 text-[14px] leading-relaxed shadow-xs md:p-7">{data.text}</article>
          )}
        </div>
      )}
      {sendOpen && data && <SendDialog doc={data} onClose={() => setSendOpen(false)} onSent={() => { setSendOpen(false); void mutate(); onChanged(data.id); }} />}
    </Drawer>
  );
}

function SendDialog({ doc, onClose, onSent }: { doc: DocDetail; onClose: () => void; onSent: () => void }) {
  const t = useTranslations('documents.sendDialog');
  const common = useTranslations('shell.common');
  const toast = useToast();
  const api = useApiMutation();
  const [name, setName] = React.useState(doc.fields.client ? String(doc.fields.client) : '');
  const [phone, setPhone] = React.useState(doc.fields.clientPhone ? String(doc.fields.clientPhone) : '');
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('title')}
      description={t('description')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{common('cancel')}</Button>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/crm/documents/${doc.id}/send`, { body: { signerName: name, signerPhone: phone || null } });
                toast({ title: t('sent'), tone: 'success' });
                onSent();
              } catch (e) {
                toast({ title: errorMessage(e), tone: 'danger' });
                setBusy(false);
              }
            }}
          >
            {t('submit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t('phone')}>
          <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="tabular" />
        </Field>
      </div>
    </Dialog>
  );
}
