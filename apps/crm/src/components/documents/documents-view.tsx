'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Copy, FileDown, FilePlus2, FileSignature, Send, Trash2 } from 'lucide-react';
import { DOCUMENT_TEMPLATE_LABELS_KA, DOCUMENT_TEMPLATES, formatDateKa, type CrmDocument } from '@lokacia/contracts';
import { Button, Dialog, Drawer, EmptyState, Field, Input, Select, Skeleton, Table, Textarea, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { ContactPicker } from '@/components/common/pickers';
import { downloadFile, errorMessage } from '@/lib/api-client';
import { Can } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import { SignStatusBadge } from './status-badge';

type DocDetail = CrmDocument & { versions: { id: string; version: number; signStatus: CrmDocument['signStatus']; createdAt: string }[] };
type DealOption = { id: string; title: string };

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
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(`${pathname}${p.size ? `?${p}` : ''}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button icon={<FilePlus2 className="size-4" strokeWidth={1.5} />} onClick={() => setParam('new', '1')}>
            {t('new')}
          </Button>
        }
      />
      {isLoading && <Skeleton className="h-48" />}
      {data && data.length === 0 && <EmptyState icon={<FileSignature className="size-5" strokeWidth={1.5} aria-hidden />} title={t('empty')} description={t('emptyHint')} action={<Button onClick={() => setParam('new', '1')}>{t('new')}</Button>} />}
      {data && data.length > 0 && (
        <Table
          rows={data}
          rowKey={(r) => r.id}
          onRowClick={(r) => setParam('id', r.id)}
          initialSort={{ key: 'created', dir: 'desc' }}
          columns={[
            { key: 'title', header: t('cols.title'), sortValue: (r) => r.title, cell: (r) => <div><div className="font-medium">{r.title}</div>{r.title !== DOCUMENT_TEMPLATE_LABELS_KA[r.template] && <div className="text-small text-muted">{DOCUMENT_TEMPLATE_LABELS_KA[r.template]}</div>}</div> },
            { key: 'related', header: t('cols.related'), cell: (r) => <div className="text-small">{r.dealTitle && <div>{r.dealTitle}</div>}{r.contactName && <div className="text-muted">{r.contactName}</div>}</div> },
            { key: 'version', header: t('cols.version'), align: 'right', sortValue: (r) => r.version, cell: (r) => <span className="tabular">v{r.version}</span> },
            { key: 'status', header: t('cols.status'), sortValue: (r) => r.signStatus, cell: (r) => <SignStatusBadge status={r.signStatus} /> },
            { key: 'created', header: t('cols.created'), sortValue: (r) => r.createdAt, cell: (r) => <span className="text-small text-muted tabular">{formatDateKa(r.createdAt)}</span> },
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
      {openId && <DocumentDrawer id={openId} onClose={() => setParam('id', null)} onChanged={(id) => { void mutate(); if (id !== openId) setParam('id', id); }} />}
    </>
  );
}

function CreateDocumentDialog({ dealId, contactId, onClose, onCreated }: { dealId: string | null; contactId: string | null; onClose: () => void; onCreated: (id: string) => void }) {
  const t = useTranslations('documents');
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
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('new')} footer={<><Button variant="ghost" onClick={onClose}>გაუქმება</Button><Button onClick={submit} loading={busy}>{t('form.create')}</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label={t('form.template')}>
          <Select value={template} onChange={(e) => setTemplate(e.target.value as typeof template)} options={DOCUMENT_TEMPLATES.map((k) => ({ value: k, label: DOCUMENT_TEMPLATE_LABELS_KA[k] }))} />
        </Field>
        <Field label={t('form.deal')}>
          <Select value={deal} onChange={(e) => setDeal(e.target.value)} placeholder="—" options={[...(dealId && !deals.some((d) => d.id === dealId) ? [{ value: dealId, label: dealId }] : []), ...deals.map((d) => ({ value: d.id, label: d.title }))]} />
        </Field>
        {!deal && (
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium">{t('form.contact')}</span>
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
          <div className="flex flex-wrap items-center gap-2">
            <SignStatusBadge status={data.signStatus} />
            <span className="text-small text-muted">{DOCUMENT_TEMPLATE_LABELS_KA[data.template]}</span>
            {data.dealId && <Link className="text-small text-link hover:underline" href={`/deals/${data.dealId}`}>{data.dealTitle}</Link>}
            {data.contactId && <Link className="text-small text-link hover:underline" href={`/contacts/${data.contactId}`}>{data.contactName}</Link>}
          </div>
          <div>
            <div className="mb-1.5 text-small font-medium">{t('detail.versions')}</div>
            <div className="flex flex-wrap gap-1.5">
              {data.versions.map((v) => (
                <button key={v.id} type="button" onClick={() => onChanged(v.id)} aria-pressed={v.id === data.id} className={`h-8 rounded-button border px-2.5 text-small tabular ${v.id === data.id ? 'border-primary bg-primary text-primary-contrast' : 'border-border hover:bg-surface-2'}`}>
                  {t('detail.version', { n: v.version })}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<FileDown className="size-4" strokeWidth={1.5} />} onClick={() => downloadFile(`/crm/documents/${data.id}/pdf`, `${data.title}-v${data.version}.pdf`)}>
              {t('detail.pdf')}
            </Button>
            {latest && !locked && (
              <Button variant="secondary" size="sm" onClick={() => { setText(data.text); setEditing(true); }}>
                {t('detail.newVersion')}
              </Button>
            )}
            {latest && data.signStatus !== 'signed' && (
              <Can perm="documents.sign">
                <Button size="sm" icon={<Send className="size-4" strokeWidth={1.5} />} onClick={() => setSendOpen(true)}>
                  {t('detail.send')}
                </Button>
              </Can>
            )}
            {data.signStatus !== 'signed' && (
              <Can perm="records.delete">
                <Button variant="danger" size="sm" icon={<Trash2 className="size-4" strokeWidth={1.5} />} onClick={async () => { await api(`/crm/documents/${data.id}`, { method: 'DELETE' }); onChanged(data.id); onClose(); }}>
                  {t('detail.delete')}
                </Button>
              </Can>
            )}
          </div>
          {locked && <p className="text-small text-muted">{t('detail.locked')}</p>}
          {data.signUrl && (
            <div className="flex items-center gap-2 rounded-card border border-border bg-bg p-2">
              <span className="text-small text-muted">{t('detail.signLink')}:</span>
              <a href={data.signUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-small text-link">{data.signUrl}</a>
              <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" strokeWidth={1.5} />} onClick={() => { void navigator.clipboard.writeText(data.signUrl!); toast({ title: t('detail.copied') }); }}>
                {t('detail.copy')}
              </Button>
            </div>
          )}
          {editing ? (
            <div className="flex flex-col gap-2">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[50dvh] font-[inherit] text-[14px]" aria-label={t('detail.editText')} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(false)}>გაუქმება</Button>
                <Button onClick={saveVersion} loading={busy}>{t('detail.saveVersion')}</Button>
              </div>
            </div>
          ) : (
            <article className="whitespace-pre-wrap rounded-card border border-border bg-bg p-4 text-[14px] leading-relaxed">{data.text}</article>
          )}
        </div>
      )}
      {sendOpen && data && <SendDialog doc={data} onClose={() => setSendOpen(false)} onSent={() => { setSendOpen(false); void mutate(); onChanged(data.id); }} />}
    </Drawer>
  );
}

function SendDialog({ doc, onClose, onSent }: { doc: DocDetail; onClose: () => void; onSent: () => void }) {
  const t = useTranslations('documents.sendDialog');
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
          <Button variant="ghost" onClick={onClose}>გაუქმება</Button>
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
