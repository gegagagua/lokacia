'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { slugify } from '@lokacia/contracts';
import { Badge, Button, Card, IconButton, Input, Select, Skeleton, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { RequirePerm } from '@/components/common/require-perm';
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

  if (!data) return <Skeleton className="h-96" />;
  const targets = rows.map((r) => ({ value: r.key, label: r.name }));

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={
          <Link href="/settings" className="inline-flex items-center gap-1 text-link hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={1.5} aria-hidden /> {settings('title')}
          </Link>
        }
        title={t('title')}
        subtitle={t('subtitle')}
      />
      <Card className="p-2">
        <ol className="flex flex-col">
          {rows.map((r, i) => (
            <li key={`${r.key}-${i}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-border p-2 last:border-b-0 sm:grid-cols-[auto_1fr_150px_140px_auto]">
              <div className="flex flex-col">
                <IconButton label={t('moveUp')} size="sm" disabled={i === 0} onClick={() => swap(i, i - 1)} className="h-6">
                  <ArrowUp className="size-3.5" strokeWidth={1.5} />
                </IconButton>
                <IconButton label={t('moveDown')} size="sm" disabled={i === rows.length - 1} onClick={() => swap(i, i + 1)} className="h-6">
                  <ArrowDown className="size-3.5" strokeWidth={1.5} />
                </IconButton>
              </div>
              <div className="min-w-0">
                <Input aria-label={t('name')} value={r.name} onChange={(e) => set(i, { name: e.target.value, ...(r.isNew ? { key: slugify(e.target.value).replace(/[^a-z0-9_-]/g, '') || r.key } : {}) })} />
                <div className="mt-0.5 flex gap-2 text-[11px] text-muted">
                  <code>{r.key}</code>
                  {r.dealsCount > 0 && <span className="tabular">{t('deals', { count: r.dealsCount })}</span>}
                </div>
              </div>
              <Select aria-label={t('kind')} value={r.kind} onChange={(e) => set(i, { kind: e.target.value as Row['kind'] })} options={(['open', 'won', 'lost'] as const).map((k) => ({ value: k, label: t(`kinds.${k}`) }))} className="hidden sm:block" />
              <span className="hidden sm:block">{r.kind !== 'open' && <Badge tone={r.kind === 'won' ? 'success' : 'danger'}>{t(`kinds.${r.kind}`)}</Badge>}</span>
              <IconButton
                label={t('remove')}
                size="sm"
                onClick={() => {
                  setRows((x) => x.filter((_, j) => j !== i));
                  if (!r.isNew && r.dealsCount > 0) setRemoved((x) => [...x, r]);
                }}
              >
                <Trash2 className="size-4 text-danger" strokeWidth={1.5} />
              </IconButton>
            </li>
          ))}
        </ol>
        <div className="p-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="size-4" strokeWidth={1.5} aria-hidden />}
            onClick={() => {
              const firstClosed = rows.findIndex((r) => r.kind !== 'open');
              const row: Row = { key: `stage-${Date.now().toString(36)}`, name: t('newStage'), kind: 'open', dealsCount: 0, isNew: true };
              setRows((x) => (firstClosed < 0 ? [...x, row] : [...x.slice(0, firstClosed), row, ...x.slice(firstClosed)]));
            }}
          >
            {t('add')}
          </Button>
        </div>
      </Card>
      {removed.filter((r) => !rows.some((x) => x.key === r.key)).length > 0 && (
        <Card className="mt-4 flex flex-col gap-3 border-accent p-4">
          {removed
            .filter((r) => !rows.some((x) => x.key === r.key))
            .map((r) => (
              <div key={r.key} className="flex flex-wrap items-center gap-3">
                <span className="flex-1">
                  <span className="font-medium">{r.name}</span> <span className="text-small text-muted tabular">· {t('deals', { count: r.dealsCount })}</span>
                </span>
                <Select aria-label={t('moveTo')} value={moveTo[r.key] ?? ''} placeholder={t('moveTo')} onChange={(e) => setMoveTo((m) => ({ ...m, [r.key]: e.target.value }))} options={targets} className="w-60" />
              </div>
            ))}
        </Card>
      )}
      {errors.length > 0 && (
        <ul role="alert" className="mt-3 list-inside list-disc text-small text-danger">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <Button onClick={save} loading={busy}>
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
