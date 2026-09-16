'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CalendarDays, Crown, GitMerge, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { normalizePhone, formatDateKa, type DuplicateCluster } from '@lokacia/contracts';
import { Button, Checkbox, cn, Dialog, EmptyState, Skeleton, useToast } from '@lokacia/ui';
import { Pill, PersonAvatar, Progress } from '@/components/common/ui';
import { PageHeader } from '@/components/common/page-header';
import { errorMessage } from '@/lib/api-client';
import { useApi, useApiMutation } from '@/lib/swr';

/** C1: manual confirmation of duplicate merges (phone E.164 + trigram name similarity). */
export function DuplicatesView() {
  const t = useTranslations('contacts');
  const { data, isLoading, mutate } = useApi<DuplicateCluster[]>('/crm/contacts/duplicates');
  return (
    <div>
      <PageHeader
        back={
          <Link href="/contacts" className="inline-flex items-center gap-1 text-muted hover:text-text">
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
            {t('detail.back')}
          </Link>
        }
        title={t('duplicates.title')}
        subtitle={t('duplicates.subtitle')}
      />
      {isLoading && <Skeleton className="h-64 rounded-card" />}
      {data?.length === 0 && <EmptyState icon={<ShieldCheck className="size-5" strokeWidth={2} aria-hidden />} title={t('duplicates.empty')} description={t('duplicates.emptyHint')} />}
      <div className="flex flex-col gap-5">
        {data?.map((cluster) => (
          <ClusterCard key={cluster.contacts.map((c) => c.id).join(':')} cluster={cluster} onMerged={() => mutate()} />
        ))}
      </div>
    </div>
  );
}

function ClusterCard({ cluster, onMerged }: { cluster: DuplicateCluster; onMerged: () => void }) {
  const t = useTranslations('contacts');
  const common = useTranslations('shell.common');
  const toast = useToast();
  const mutate = useApiMutation();
  const [target, setTarget] = React.useState(cluster.contacts[0]!.id);
  const [sources, setSources] = React.useState<string[]>(cluster.contacts.slice(1).map((c) => c.id));
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const targetContact = cluster.contacts.find((c) => c.id === target)!;
  const chosen = cluster.contacts.filter((c) => c.id === target || sources.includes(c.id));
  const preview = {
    phones: [...new Set(chosen.flatMap((c) => c.phones.map((p) => normalizePhone(p) ?? p)))],
    emails: [...new Set(chosen.flatMap((c) => c.emails.map((e) => e.toLowerCase())))],
    tags: [...new Set(chosen.flatMap((c) => c.tags))],
    company: targetContact.company ?? chosen.find((c) => c.company)?.company ?? null,
  };

  const merge = async () => {
    setBusy(true);
    try {
      await mutate('/crm/contacts/merge', { body: { targetId: target, sourceIds: sources.filter((s) => s !== target) } });
      toast({ title: t('duplicates.merged'), tone: 'success' });
      setConfirm(false);
      onMerged();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card overflow-hidden" aria-label={t('duplicates.groupLabel')}>
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/50 px-4 py-3 md:px-5">
        <span className="grid size-8 place-items-center rounded-[10px] bg-tone-soft text-tone-ink tone-3" aria-hidden>
          <GitMerge className="size-4" strokeWidth={2} />
        </span>
        {cluster.reasons.map((r) => (
          <Pill key={r} tone={r === 'phone' ? 2 : 4} icon={r === 'phone' ? Phone : UserRound}>
            {r === 'phone' ? t('duplicates.reasonPhone') : t('duplicates.reasonName')}
          </Pill>
        ))}
        <span className="ml-auto text-[13px] font-medium text-muted tabular">{t('duplicates.contactsCount', { count: cluster.contacts.length })}</span>
      </header>
      <div className="grid gap-3 p-3 sm:grid-cols-2 md:p-4 xl:grid-cols-3">
        {cluster.contacts.map((c) => {
          const isTarget = c.id === target;
          const isSource = !isTarget && sources.includes(c.id);
          return (
            <div
              key={c.id}
              className={cn(
                'relative flex flex-col gap-3 rounded-2xl border-2 p-4 transition-all duration-200',
                isTarget ? 'border-primary bg-primary-soft/40 shadow-sm' : isSource ? 'border-tone-soft bg-tone-faint tone-3' : 'border-border bg-surface opacity-80',
              )}
            >
              <div className="flex items-start gap-3">
                <PersonAvatar name={c.name} size={44} />
                <div className="min-w-0 flex-1">
                  <Link href={`/contacts/${c.id}`} className="block truncate font-semibold hover:underline">
                    {c.name}
                  </Link>
                  <div className="truncate text-[13px] text-muted">{c.company ?? '\u00a0'}</div>
                </div>
                {isTarget && (
                  <Pill tone="primary" icon={Crown} size="sm">
                    {t('duplicates.keepThis')}
                  </Pill>
                )}
              </div>
              <dl className="flex flex-col gap-1.5 text-[13.5px]">
                <div className="flex items-center gap-2">
                  <dt className="sr-only">{t('columns.phone')}</dt>
                  <Phone className="size-3.5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
                  <dd className="truncate tabular">{c.phones.join(', ') || '—'}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="sr-only">{t('columns.agent')}</dt>
                  <UserRound className="size-3.5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
                  <dd className="truncate">{c.ownerAgentName ?? '—'}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="sr-only">{t('columns.created')}</dt>
                  <CalendarDays className="size-3.5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
                  <dd className="truncate text-muted">{formatDateKa(c.createdAt)}</dd>
                </div>
              </dl>
              {cluster.reasons.includes('name') && c.similarity < 1 && (
                <div>
                  <div className="mb-1 text-[12.5px] text-muted tabular">{t('duplicates.similarity', { pct: Math.round(c.similarity * 100) })}</div>
                  <Progress value={c.similarity * 100} tone={3} label={t('duplicates.similarity', { pct: Math.round(c.similarity * 100) })} />
                </div>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-[13.5px]">
                <label className="inline-flex cursor-pointer items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name={`target-${cluster.key}`}
                    checked={isTarget}
                    onChange={() => {
                      setTarget(c.id);
                      setSources(cluster.contacts.filter((x) => x.id !== c.id).map((x) => x.id));
                    }}
                    aria-label={`${t('duplicates.keep')}: ${c.name}`}
                    className="size-4 accent-[var(--primary)]"
                  />
                  {t('duplicates.keep')}
                </label>
                {!isTarget && (
                  <Checkbox label={t('duplicates.mergeInto')} checked={sources.includes(c.id)} onCheckedChange={(v) => setSources((s) => (v === true ? [...s, c.id] : s.filter((x) => x !== c.id)))} aria-label={`${t('duplicates.mergeInto')}: ${c.name}`} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <footer className="flex flex-col gap-3 border-t border-border px-4 py-3.5 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="min-w-0 text-[13.5px]">
          <div className="font-semibold">{t('duplicates.preview')}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-muted tabular">
            <span className="font-medium text-text">{targetContact.name}</span>
            {preview.phones.map((p) => (
              <Pill key={p} size="sm">
                {p}
              </Pill>
            ))}
            {preview.emails.map((e) => (
              <Pill key={e} size="sm">
                {e}
              </Pill>
            ))}
            {preview.tags.map((tag) => (
              <Pill key={tag} size="sm" tone={1} dot>
                {tag}
              </Pill>
            ))}
            {preview.company && <span>· {preview.company}</span>}
          </div>
        </div>
        <Button size="sm" disabled={!sources.length} onClick={() => setConfirm(true)} icon={<GitMerge className="size-4" strokeWidth={2} aria-hidden />} className="shrink-0 self-start md:self-auto">
          {t('duplicates.merge')}
        </Button>
      </footer>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        size="sm"
        title={t('duplicates.confirmTitle')}
        description={t('duplicates.confirmBody', { count: sources.length, name: targetContact.name })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {common('cancel')}
            </Button>
            <Button onClick={merge} loading={busy}>
              {t('duplicates.merge')}
            </Button>
          </>
        }
      />
    </section>
  );
}
