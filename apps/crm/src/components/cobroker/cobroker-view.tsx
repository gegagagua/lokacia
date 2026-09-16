'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Building2, Check, ExternalLink, Handshake, Inbox, Percent, Phone, Share2, X } from 'lucide-react';
import { COBROKER_STATUS_LABELS_KA, formatArea, formatDateKa, formatMoney, type ListingCard } from '@lokacia/contracts';
import { Button, Combobox, Dialog, EmptyState, Field, Input, Skeleton, Slider, Tabs, Textarea, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { PersonAvatar, Pill, StatCard, type Tone } from '@/components/common/ui';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { Can, useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';

type Org = { id: string; name: string; slug: string; phone?: string | null };
type Share = { id: string; status: keyof typeof COBROKER_STATUS_LABELS_KA; splitPct: number; note: string | null; createdAt: string; fromOrg: Org | null; toOrg: Org | null; listing: ListingCard | null };

const tone = (s: Share['status']): Tone => (s === 'accepted' ? 'success' : s === 'proposed' ? 2 : s === 'declined' ? 'danger' : 'neutral');

function SplitBar({ mine, theirs, mineLabel, theirsLabel }: { mine: number; theirs: number; mineLabel: string; theirsLabel: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${mineLabel} ${mine}% · ${theirsLabel} ${theirs}%`}>
        <span className="h-full bg-primary-500" style={{ width: `${mine}%` }} />
        <span className="h-full bg-tone tone-3" style={{ width: `${theirs}%` }} />
      </div>
      <div className="flex justify-between text-[12.5px] font-medium tabular">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary-500" aria-hidden />
          {mineLabel} <b>{mine}%</b>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="tone-3 size-2 rounded-full bg-tone" aria-hidden />
          {theirsLabel} <b>{theirs}%</b>
        </span>
      </div>
    </div>
  );
}

function ListingThumb({ listing }: { listing: ListingCard | null }) {
  return (
    <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
      {listing?.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={listing.cover} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <Building2 className="m-4 size-6 text-muted" strokeWidth={2} aria-hidden />
      )}
    </div>
  );
}

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

  const cards = (rows: Share[], dir: 'incoming' | 'outgoing') =>
    !rows.length ? (
      <EmptyState icon={<Handshake className="size-6" strokeWidth={2} aria-hidden />} title={t(`empty.${dir}`)} />
    ) : (
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => {
          const partner = dir === 'incoming' ? r.fromOrg : r.toOrg;
          const theirs = dir === 'incoming' ? 100 - r.splitPct : r.splitPct;
          const mine = 100 - theirs;
          return (
            <li key={r.id} className="card flex flex-col gap-4 p-4">
              <div className="flex items-start gap-3">
                <ListingThumb listing={r.listing} />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-[14.5px] font-semibold leading-5">{r.listing?.title ?? '—'}</div>
                  {r.listing && (
                    <div className="mt-0.5 truncate text-[12.5px] text-muted">
                      {r.listing.address} · <span className="font-semibold text-text tabular">{formatMoney(r.listing.priceMinor)}</span>
                    </div>
                  )}
                </div>
                <Pill tone={tone(r.status)} dot size="sm">
                  {COBROKER_STATUS_LABELS_KA[r.status]}
                </Pill>
              </div>
              <div className="flex items-center gap-2.5 rounded-2xl bg-surface-2 p-2.5">
                <PersonAvatar name={partner?.name} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] leading-4 text-muted">{t('cols.partner')}</div>
                  <div className="truncate text-[14px] font-semibold leading-5">{partner?.name ?? '—'}</div>
                </div>
                <span className="text-[12px] text-muted tabular">{formatDateKa(r.createdAt)}</span>
              </div>
              <SplitBar mine={mine} theirs={theirs} mineLabel={t('us')} theirsLabel={t('partner')} />
              {r.note && <p className="border-l-2 border-border-strong pl-3 text-[13.5px] text-muted">{r.note}</p>}
              <div className="mt-auto flex flex-wrap gap-1.5">
                {dir === 'incoming' && r.status === 'proposed' && (role === 'manager' || role === 'admin') && (
                  <>
                    <Button size="sm" icon={<Check className="size-4" strokeWidth={2.2} aria-hidden />} onClick={() => act(r.id, 'accept')}>
                      {t('accept')}
                    </Button>
                    <Button size="sm" variant="ghost" icon={<X className="size-4" strokeWidth={2.2} aria-hidden />} onClick={() => act(r.id, 'decline')}>
                      {t('decline')}
                    </Button>
                  </>
                )}
                {dir === 'outgoing' && (r.status === 'proposed' || r.status === 'accepted') && (
                  <Can perm="listings.publish">
                    <Button size="sm" variant="ghost" onClick={() => act(r.id, 'revoke')}>
                      {t('revoke')}
                    </Button>
                  </Can>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );

  const proposed = data?.incoming.filter((s) => s.status === 'proposed').length ?? 0;
  const accepted = [...(data?.incoming ?? []), ...(data?.outgoing ?? [])].filter((s) => s.status === 'accepted').length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        className="mb-0"
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Can perm="listings.publish">
            <Button size="sm" icon={<Share2 className="size-4" strokeWidth={2} />} onClick={() => setOpen(true)}>
              {t('share')}
            </Button>
          </Can>
        }
      />
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard label={t('tabs.incoming')} value={data.incoming.length} icon={Inbox} tone={2} hint={proposed ? t('kpi.awaiting', { count: proposed }) : undefined} />
          <StatCard label={t('tabs.outgoing')} value={data.outgoing.length} icon={Share2} tone={4} />
          <StatCard label={t('kpi.accepted')} value={accepted} icon={Handshake} tone="success" />
          <StatCard label={t('tabs.shared')} value={shared?.length ?? '—'} icon={Building2} tone={3} />
        </div>
      )}
      {isLoading || !data ? (
        <Skeleton className="h-48 rounded-card" />
      ) : (
        <Tabs
          tabs={[
            { value: 'incoming', label: t('tabs.incoming'), count: proposed, content: cards(data.incoming, 'incoming') },
            { value: 'outgoing', label: t('tabs.outgoing'), count: data.outgoing.length, content: cards(data.outgoing, 'outgoing') },
            {
              value: 'shared',
              label: t('tabs.shared'),
              count: shared?.length ?? 0,
              content: !shared?.length ? (
                <EmptyState icon={<Handshake className="size-6" strokeWidth={2} aria-hidden />} title={t('empty.shared')} />
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {shared.map((s) => (
                    <li key={s.id} className="card card-hover group flex flex-col overflow-hidden">
                      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
                        {s.listing?.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.listing.cover} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" loading="lazy" />
                        ) : (
                          <div className="drawing-grid grid size-full place-items-center text-muted">
                            <Building2 className="size-10" strokeWidth={1.5} aria-hidden />
                          </div>
                        )}
                        <span className="absolute right-3 top-3 inline-flex h-8 items-center gap-1 rounded-full bg-accent px-3 text-[13.5px] font-bold text-accent-contrast shadow-md tabular">
                          <Percent className="size-3.5" strokeWidth={2.4} aria-hidden />
                          {s.splitPct}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <div className="line-clamp-2 font-semibold leading-6">{s.listing?.title ?? '—'}</div>
                        {s.listing && (
                          <div className="text-[13px] text-muted">
                            {s.listing.address} · <span className="tabular">{formatArea(s.listing.areaM2)}</span>
                          </div>
                        )}
                        {s.listing && <div className="text-[18px] font-bold tracking-tight tabular">{formatMoney(s.listing.priceMinor)}</div>}
                        <div className="flex items-center gap-2 text-[13px]">
                          <PersonAvatar name={s.fromOrg?.name} size={24} />
                          <span className="min-w-0 truncate font-medium">{s.fromOrg?.name}</span>
                          {s.fromOrg?.phone && (
                            <a href={`tel:${s.fromOrg.phone}`} className="ml-auto inline-flex shrink-0 items-center gap-1 text-muted tabular hover:text-text">
                              <Phone className="size-3.5" strokeWidth={2} aria-hidden />
                              {s.fromOrg.phone}
                            </a>
                          )}
                        </div>
                        {s.note && <p className="text-[13.5px] text-muted">{s.note}</p>}
                        {s.listing && (
                          <div className="mt-auto flex gap-2 pt-2">
                            <Button asChild size="sm">
                              <Link href={`/deals?new=1&listingId=${s.listing.id}`}>{t('createDeal')}</Link>
                            </Button>
                            <Button asChild size="sm" variant="ghost">
                              <a href={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100'}/listings/${s.listing.slug}`} target="_blank" rel="noreferrer">
                                lokacia.ge
                                <ExternalLink className="size-3.5" strokeWidth={2} aria-hidden />
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      )}
      {open && (
        <ShareDialog
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            void mutate();
          }}
        />
      )}
    </div>
  );
}

function ShareDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations('cobroker.form');
  const tc = useTranslations('cobroker');
  const common = useTranslations('shell.common');
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
          <Button variant="ghost" onClick={onClose}>
            {common('cancel')}
          </Button>
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
          <span className="text-[14px] font-semibold">{t('listing')}</span>
          <Combobox options={(mine ?? []).map((l) => ({ value: l.id, label: l.title, hint: l.address }))} value={listingId} onChange={setListingId} label={t('listing')} />
        </div>
        <div className="flex flex-col gap-1.5" onInput={(e) => setQ((e.target as HTMLInputElement).value)}>
          <span className="text-[14px] font-semibold">{t('org')}</span>
          <Combobox options={orgs.map((o) => ({ value: o.id, label: o.name }))} value={toOrgId} onChange={setToOrgId} placeholder={t('orgSearch')} label={t('org')} />
        </div>
        <Field label={t('split')}>
          <Input type="number" min={1} max={99} value={split} onChange={(e) => setSplit(Math.min(99, Math.max(1, Number(e.target.value) || 1)))} className="tabular" />
        </Field>
        <Slider min={1} max={99} step={1} value={[split]} onValueChange={(v) => setSplit(v[0]!)} aria-label={t('split')} />
        <SplitBar mine={100 - split} theirs={split} mineLabel={tc('us')} theirsLabel={tc('partner')} />
        <p className="sr-only">{t('preview', { mine: 100 - split, theirs: split })}</p>
        <Field label={t('note')}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
