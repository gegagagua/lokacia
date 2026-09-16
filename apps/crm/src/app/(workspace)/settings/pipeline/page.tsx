'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ChevronDown, ChevronUp, GitBranch, GripVertical, Plus, Save, Trash2, TriangleAlert } from 'lucide-react';
import { slugify } from '@lokacia/contracts';
import { Button, cn, IconButton, Input, Select, Skeleton, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { RequirePerm } from '@/components/common/require-perm';
import { SectionCard } from '@/components/common/ui';
import { ClientApiError, errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import type { PipelineStage } from '@/lib/types';

type Row = PipelineStage & { dealsCount: number; isNew?: boolean };

export default function PipelineSettingsPage() {
  return (
    <RequirePerm perm="pipeline.manage">
      <PipelineEditor />
    </RequirePerm>
  );
}

function PipelineEditor() {
  const t = useTranslations('team.pipeline');
  const settings = useTranslations('team.settings');
  const toast = useToast();
  const mutateApi = useApiMutation();
  const { refreshWorkspace } = useCrm();
  const { data, mutate } = useApi<{ id: string; name: string; stages: Row[] }>('/crm/pipelines/default');
  const [rows, setRows] = React.useState<Row[]>([]);
  const [removed, setRemoved] = React.useState<Row[]>([]);
  const [moveTo, setMoveTo] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!data) return;
    setRows(data.stages);
    setRemoved([]);
    setMoveTo({});
  }, [data]);

  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const swap = (i: number, j: number) =>
    setRows((r) => {
      if (j < 0 || j >= r.length) return r;
      const n = [...r];
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });

  const save = async () => {
    setBusy(true);
    setErrors([]);
    try {
      await mutateApi('/crm/pipelines/default', { method: 'PUT', body: { stages: rows.map(({ key, name, kind }) => ({ key, name, kind })), moveTo } });
      toast({ title: t('saved'), tone: 'success' });
      await Promise.all([mutate(), refreshWorkspace()]);
    } catch (e) {
      if (e instanceof ClientApiError && e.problem?.errors?.length) setErrors(e.problem.errors.map((x) => x.message));
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Skeleton className="h-96 rounded-card" />;
  const targets = rows.map((r) => ({ value: r.key, label: r.name }));
  const OPEN_TONES = [2, 3, 4, 6, 7, 5, 1] as const;
  let openIdx = 0;
  const toneOf = (r: Row) => (r.kind === 'won' ? 'tone-success' : r.kind === 'lost' ? 'tone-danger' : `tone-${OPEN_TONES[openIdx++ % OPEN_TONES.length]}`);
  const orphaned = removed.filter((r) => !rows.some((x) => x.key === r.key));

  return (
    <div className="max-w-4xl">
      <PageHeader
        back={
          <Link href="/settings" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden /> {settings('title')}
          </Link>
        }
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button onClick={save} loading={busy} icon={<Save className="size-4" strokeWidth={2} aria-hidden />}>
            {t('save')}
          </Button>
        }
      />
      <SectionCard
        title={t('stagesTitle')}
        description={t('stagesHint')}
        icon={GitBranch}
        tone={1}
        bodyClassName="p-2 md:p-3"
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="size-4" strokeWidth={2} aria-hidden />}
            onClick={() => {
              const firstClosed = rows.findIndex((r) => r.kind !== 'open');
              const row: Row = { key: `stage-${Date.now().toString(36)}`, name: t('newStage'), kind: 'open', dealsCount: 0, isNew: true };
              setRows((x) => (firstClosed < 0 ? [...x, row] : [...x.slice(0, firstClosed), row, ...x.slice(firstClosed)]));
            }}
          >
            {t('add')}
          </Button>
        }
      >
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const tone = toneOf(r);
            return (
              <li key={`${r.key}-${i}`} className={cn('group relative grid grid-cols-[auto_1fr_auto] items-center gap-2 overflow-hidden rounded-2xl border border-border bg-surface py-2 pl-3 pr-2 transition-all duration-200 hover:border-border-strong hover:shadow-sm sm:grid-cols-[auto_auto_1fr_170px_auto] sm:gap-3', tone)}>
                <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-tone" />
                <div className="flex items-center gap-1">
                  <GripVertical className="hidden size-4 text-border-strong sm:block" strokeWidth={2} aria-hidden />
                  <div className="flex flex-col">
                    <IconButton label={t('moveUp')} size="sm" disabled={i === 0} onClick={() => swap(i, i - 1)} className="h-6 w-8 rounded-md">
                      <ChevronUp className="size-4" strokeWidth={2} />
                    </IconButton>
                    <IconButton label={t('moveDown')} size="sm" disabled={i === rows.length - 1} onClick={() => swap(i, i + 1)} className="h-6 w-8 rounded-md">
                      <ChevronDown className="size-4" strokeWidth={2} />
                    </IconButton>
                  </div>
                </div>
                <span aria-hidden className="hidden size-9 place-items-center rounded-xl bg-tone-soft text-[13px] font-bold tabular text-tone-ink sm:grid">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <Input aria-label={t('name')} value={r.name} onChange={(e) => set(i, { name: e.target.value, ...(r.isNew ? { key: slugify(e.target.value).replace(/[^a-z0-9_-]/g, '') || r.key } : {}) })} className="h-10 font-medium" />
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                    <code className="rounded bg-surface-2 px-1.5 py-0.5">{r.key}</code>
                    {r.dealsCount > 0 && <span className="rounded-full bg-tone-soft px-2 py-0.5 font-semibold tabular text-tone-ink">{t('deals', { count: r.dealsCount })}</span>}
                    {r.kind !== 'open' && <span className="rounded-full bg-tone-soft px-2 py-0.5 font-semibold text-tone-ink sm:hidden">{t(`kinds.${r.kind}`)}</span>}
                  </div>
                </div>
                <Select aria-label={t('kind')} value={r.kind} onChange={(e) => set(i, { kind: e.target.value as Row['kind'] })} options={(['open', 'won', 'lost'] as const).map((k) => ({ value: k, label: t(`kinds.${k}`) }))} className="hidden h-10 sm:block" />
                <IconButton
                  label={t('remove')}
                  size="sm"
                  className="rounded-full text-muted hover:bg-danger/10 hover:text-danger"
                  onClick={() => {
                    setRows((x) => x.filter((_, j) => j !== i));
                    if (!r.isNew && r.dealsCount > 0) setRemoved((x) => [...x, r]);
                  }}
                >
                  <Trash2 className="size-4" strokeWidth={2} />
                </IconButton>
              </li>
            );
          })}
        </ol>
      </SectionCard>
      {orphaned.length > 0 && (
        <SectionCard className="mt-5 border-accent/60" title={t('removedTitle')} description={t('removedHint')} icon={TriangleAlert} tone="accent" bodyClassName="flex flex-col gap-3">
          {orphaned.map((r) => (
            <div key={r.key} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 p-3">
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{r.name}</span> <span className="text-small text-muted tabular">· {t('deals', { count: r.dealsCount })}</span>
              </span>
              <Select aria-label={t('moveTo')} value={moveTo[r.key] ?? ''} placeholder={t('moveTo')} onChange={(e) => setMoveTo((m) => ({ ...m, [r.key]: e.target.value }))} options={targets} className="w-full sm:w-60" />
            </div>
          ))}
        </SectionCard>
      )}
      {errors.length > 0 && (
        <ul role="alert" className="mt-4 list-inside list-disc rounded-2xl bg-danger/10 p-4 text-small text-danger">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex justify-end">
        <Button onClick={save} loading={busy} size="lg" className="w-full sm:w-auto">
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
