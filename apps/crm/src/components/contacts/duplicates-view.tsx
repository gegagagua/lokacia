'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CopyCheck, GitMerge } from 'lucide-react';
import { normalizePhone, formatDateKa, type DuplicateCluster } from '@lokacia/contracts';
import { Badge, Button, Checkbox, cn, Dialog, EmptyState, Skeleton, useToast } from '@lokacia/ui';
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
            <ArrowLeft className="size-3.5" strokeWidth={1.5} aria-hidden />
            {t('detail.back')}
          </Link>
        }
        title={t('duplicates.title')}
        subtitle={t('duplicates.subtitle')}
      />
      {isLoading && <Skeleton className="h-48" />}
      {data?.length === 0 && <EmptyState icon={<CopyCheck className="size-5" strokeWidth={1.5} aria-hidden />} title={t('duplicates.empty')} description={t('duplicates.emptyHint')} />}
      <div className="flex flex-col gap-4">
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
    <section className="rounded-card border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        {cluster.reasons.map((r) => (
          <Badge key={r} tone={r === 'phone' ? 'link' : 'neutral'}>
            {r === 'phone' ? t('duplicates.reasonPhone') : t('duplicates.reasonName')}
          </Badge>
        ))}
        <span className="text-small text-muted tabular">{cluster.contacts.length}</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[14px] tabular">
          <thead>
            <tr className="border-b border-border text-small text-muted">
              <th scope="col" className="px-3 py-2 font-medium">{t('duplicates.keep')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('duplicates.mergeInto')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('columns.name')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('columns.phone')}</th>
              <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">{t('columns.agent')}</th>
              <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">{t('columns.created')}</th>
            </tr>
          </thead>
          <tbody>
            {cluster.contacts.map((c) => (
              <tr key={c.id} className={cn('border-b border-border last:border-b-0', c.id === target && 'bg-primary/5')}>
                <td className="px-3 py-2">
                  <input
                    type="radio"
                    name={`target-${cluster.key}`}
                    checked={c.id === target}
                    onChange={() => {
                      setTarget(c.id);
                      setSources(cluster.contacts.filter((x) => x.id !== c.id).map((x) => x.id));
                    }}
                    aria-label={`${t('duplicates.keep')}: ${c.name}`}
                    className="size-4 accent-[var(--primary)]"
                  />
                </td>
                <td className="px-3 py-2">
                  {c.id !== target && <Checkbox checked={sources.includes(c.id)} onCheckedChange={(v) => setSources((s) => (v === true ? [...s, c.id] : s.filter((x) => x !== c.id)))} aria-label={`${t('duplicates.mergeInto')}: ${c.name}`} />}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  {c.company && <div className="text-small text-muted">{c.company}</div>}
                  {cluster.reasons.includes('name') && c.similarity < 1 && <div className="text-small text-muted">{t('duplicates.similarity', { pct: Math.round(c.similarity * 100) })}</div>}
                </td>
                <td className="px-3 py-2">{c.phones.join(', ') || '—'}</td>
                <td className="hidden px-3 py-2 md:table-cell">{c.ownerAgentName ?? '—'}</td>
                <td className="hidden px-3 py-2 text-muted md:table-cell">{formatDateKa(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-wrap items-end justify-between gap-3 border-t border-border px-4 py-3">
        <div className="min-w-0 text-small">
          <div className="font-medium">{t('duplicates.preview')}</div>
          <div className="text-muted tabular">
            {targetContact.name} · {preview.phones.join(', ') || '—'}
            {preview.emails.length ? ` · ${preview.emails.join(', ')}` : ''}
            {preview.tags.length ? ` · ${preview.tags.join(', ')}` : ''}
            {preview.company ? ` · ${preview.company}` : ''}
          </div>
        </div>
        <Button size="sm" disabled={!sources.length} onClick={() => setConfirm(true)} icon={<GitMerge className="size-4" strokeWidth={1.5} aria-hidden />}>
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
