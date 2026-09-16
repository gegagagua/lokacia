'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Handshake, Share2 } from 'lucide-react';
import { COBROKER_STATUS_LABELS_KA, formatDateKa, formatMoney, type ListingCard } from '@lokacia/contracts';
import { Badge, Button, Combobox, Dialog, EmptyState, Field, Input, Skeleton, Slider, Table, Tabs, Textarea, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { Can, useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';

type Org = { id: string; name: string; slug: string; phone?: string | null };
type Share = { id: string; status: keyof typeof COBROKER_STATUS_LABELS_KA; splitPct: number; note: string | null; createdAt: string; fromOrg: Org | null; toOrg: Org | null; listing: ListingCard | null };

const tone = (s: Share['status']) => (s === 'accepted' ? 'success' : s === 'proposed' ? 'link' : s === 'declined' ? 'danger' : 'outline');

export function CobrokerView() {
  const t = useTranslations('cobroker');
  const toast = useToast();
  const api = useApiMutation();
  const { role } = useCrm();
  const { data, mutate, isLoading } = useApi<{ incoming: Share[]; outgoing: Share[] }>('/crm/cobroker');
  const { data: shared, mutate: mutateShared } = useApi<Share[]>('/crm/cobroker/shared-listings');
  const [open, setOpen] = React.useState(false);

  const act = async (id: string, action: 'accept' | 'decline' | 'revoke') => {
    try {
      await api(`/crm/cobroker/${id}/${action}`);
      await Promise.all([mutate(), mutateShared()]);
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    }
  };

  const listingCell = (s: Share) =>
    s.listing ? (
      <div className="min-w-0">
        <div className="truncate font-medium">{s.listing.title}</div>
        <div className="truncate text-small text-muted">
          {s.listing.address} · <span className="tabular">{formatMoney(s.listing.priceMinor)}</span>
        </div>
      </div>
    ) : (
      '—'
    );

  const table = (rows: Share[], dir: 'incoming' | 'outgoing') => (
    <Table
      rows={rows}
      rowKey={(r) => r.id}
      empty={t(`empty.${dir}`)}
      columns={[
        { key: 'listing', header: t('cols.listing'), cell: listingCell },
        { key: 'partner', header: t('cols.partner'), cell: (r) => (dir === 'incoming' ? r.fromOrg?.name : r.toOrg?.name) ?? '—' },
        { key: 'split', header: t('cols.split'), align: 'right', sortValue: (r) => r.splitPct, cell: (r) => <span className="tabular">{dir === 'incoming' ? `${r.splitPct}%` : `${100 - r.splitPct}% / ${r.splitPct}%`}</span> },
        { key: 'status', header: t('cols.status'), cell: (r) => <Badge tone={tone(r.status)}>{COBROKER_STATUS_LABELS_KA[r.status]}</Badge> },
        { key: 'date', header: t('cols.date'), sortValue: (r) => r.createdAt, cell: (r) => <span className="text-small text-muted tabular">{formatDateKa(r.createdAt)}</span> },
        {
          key: 'actions',
          header: t('cols.actions'),
          cell: (r) => (
            <div className="flex gap-1.5">
              {dir === 'incoming' && r.status === 'proposed' && (role === 'manager' || role === 'admin') && (
                <>
                  <Button size="sm" onClick={() => act(r.id, 'accept')}>{t('accept')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => act(r.id, 'decline')}>{t('decline')}</Button>
                </>
              )}
              {dir === 'outgoing' && (r.status === 'proposed' || r.status === 'accepted') && (
                <Can perm="listings.publish">
                  <Button size="sm" variant="ghost" onClick={() => act(r.id, 'revoke')}>{t('revoke')}</Button>
                </Can>
              )}
            </div>
          ),
        },
      ]}
    />
  );

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Can perm="listings.publish">
            <Button icon={<Share2 className="size-4" strokeWidth={1.5} />} onClick={() => setOpen(true)}>
              {t('share')}
            </Button>
          </Can>
        }
      />
      {isLoading || !data ? (
        <Skeleton className="h-48" />
      ) : (
        <Tabs
          tabs={[
            { value: 'incoming', label: t('tabs.incoming'), count: data.incoming.filter((s) => s.status === 'proposed').length, content: table(data.incoming, 'incoming') },
            { value: 'outgoing', label: t('tabs.outgoing'), count: data.outgoing.length, content: table(data.outgoing, 'outgoing') },
            {
              value: 'shared',
              label: t('tabs.shared'),
              count: shared?.length ?? 0,
              content: !shared?.length ? (
                <EmptyState icon={<Handshake className="size-5" strokeWidth={1.5} aria-hidden />} title={t('empty.shared')} />
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {shared.map((s) => (
                    <li key={s.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
                      <div className="flex items-start justify-between gap-2">
                        {listingCell(s)}
                        <Badge tone="primary">{s.splitPct}%</Badge>
                      </div>
                      <div className="text-small text-muted">
                        {s.fromOrg?.name}
                        {s.fromOrg?.phone ? ` · ${s.fromOrg.phone}` : ''}
                        {s.listing ? ` · ${s.listing.areaM2} მ²` : ''}
                      </div>
                      {s.note && <p className="text-small">{s.note}</p>}
                      {s.listing && (
                        <div className="flex gap-2">
                          <Button asChild size="sm">
                            <Link href={`/deals?new=1&listingId=${s.listing.id}`}>{t('createDeal')}</Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <a href={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100'}/listings/${s.listing.slug}`} target="_blank" rel="noreferrer">lokacia.ge</a>
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      )}
      {open && <ShareDialog onClose={() => setOpen(false)} onDone={() => { setOpen(false); void mutate(); }} />}
    </>
  );
}

function ShareDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations('cobroker.form');
  const toast = useToast();
  const api = useApiMutation();
  const { org } = useCrm();
  const { data: mine } = useApi<ListingCard[]>('/listings/mine?status=active');
  const [listingId, setListingId] = React.useState<string | null>(null);
  const [orgs, setOrgs] = React.useState<Org[]>([]);
  const [q, setQ] = React.useState('');
  const [toOrgId, setToOrgId] = React.useState<string | null>(null);
  const [split, setSplit] = React.useState(50);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    const ctl = setTimeout(() => apiFetch<Org[]>(`/crm/cobroker/orgs${q ? `?q=${encodeURIComponent(q)}` : ''}`, { orgId: org.id }).then(setOrgs).catch(() => undefined), 200);
    return () => clearTimeout(ctl);
  }, [q, org.id]);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('submit')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>გაუქმება</Button>
          <Button
            loading={busy}
            disabled={!listingId || !toOrgId}
            onClick={async () => {
              setBusy(true);
              try {
                await api('/crm/cobroker', { body: { listingId, toOrgId, splitPct: split, note: note || null } });
                toast({ title: t('sent'), tone: 'success' });
                onDone();
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
        <div className="flex flex-col gap-1.5">
          <span className="text-small font-medium">{t('listing')}</span>
          <Combobox options={(mine ?? []).map((l) => ({ value: l.id, label: l.title, hint: l.address }))} value={listingId} onChange={setListingId} label={t('listing')} />
        </div>
        <div className="flex flex-col gap-1.5" onInput={(e) => setQ((e.target as HTMLInputElement).value)}>
          <span className="text-small font-medium">{t('org')}</span>
          <Combobox options={orgs.map((o) => ({ value: o.id, label: o.name }))} value={toOrgId} onChange={setToOrgId} placeholder={t('orgSearch')} label={t('org')} />
        </div>
        <Field label={t('split')}>
          <Input type="number" min={1} max={99} value={split} onChange={(e) => setSplit(Math.min(99, Math.max(1, Number(e.target.value) || 1)))} className="tabular" />
        </Field>
        <Slider min={1} max={99} step={1} value={[split]} onValueChange={(v) => setSplit(v[0]!)} aria-label={t('split')} />
        <p className="text-small tabular text-muted">{t('preview', { mine: 100 - split, theirs: split })}</p>
        <Field label={t('note')}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
