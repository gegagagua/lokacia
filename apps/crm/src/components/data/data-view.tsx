'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, CheckCircle2, CircleAlert, Download, FileDown, FileSpreadsheet, History, Link2, ListChecks, RotateCcw, Sheet, SquareCheckBig, SquareKanban, Upload, UploadCloud, Users, type LucideIcon } from 'lucide-react';
import { EXPORT_ENTITIES, formatDateTimeKa, IMPORT_FIELD_LABELS_KA, IMPORT_FIELDS, type ImportField, type ImportPreview, type ImportResult } from '@lokacia/contracts';
import { Button, cn, Field, Input, Select, Skeleton, Stepper, Table, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { EmptyHint, IconTile, Pill, Progress, SectionCard, type Tone } from '@/components/common/ui';
import { apiFetch, downloadFile, errorMessage } from '@/lib/api-client';
import { Can, useCrm } from '@/lib/crm-context';
import { useApi } from '@/lib/swr';

type ImportRow = { id: string; fileName: string; status: 'pending' | 'done' | 'failed'; rowsTotal: number; rowsImported: number; errors: { row: number; message: string }[] | null; createdAt: string };

export function DataView() {
  const t = useTranslations('data');
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid gap-4 md:gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ImportWizard />
        <div className="flex flex-col gap-4 md:gap-5">
          <Can perm="data.export">
            <ExportCard />
          </Can>
          <ImportHistory />
        </div>
      </div>
    </>
  );
}

function ImportWizard() {
  const t = useTranslations('data.import');
  const toast = useToast();
  const { org } = useCrm();
  const { mutate } = useApi<ImportRow[]>('/crm/imports');
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, ImportField | ''>>({});
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [sheetUrl, setSheetUrl] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const accept = (p: ImportPreview) => {
    setPreview(p);
    setResult(null);
    setMapping(Object.fromEntries(p.headers.map((h) => [h, p.suggested[h] ?? ''])));
  };
  const upload = async (file: File) => {
    setBusy('upload');
    try {
      const fd = new FormData();
      fd.append('file', file);
      accept(await apiFetch<ImportPreview>('/crm/imports/preview', { method: 'POST', body: fd, orgId: org.id }));
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };
  const run = async (dryRun: boolean) => {
    if (!preview) return;
    const clean = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)) as Record<string, ImportField>;
    if (!Object.values(clean).includes('name')) return toast({ title: t('nameRequired'), tone: 'danger' });
    setBusy(dryRun ? 'dry' : 'run');
    try {
      const r = await apiFetch<ImportResult>('/crm/imports', { method: 'POST', body: { fileToken: preview.fileToken, mapping: clean, dryRun }, orgId: org.id });
      setResult(r);
      if (!dryRun) await mutate();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };
  const downloadErrors = () => {
    if (!result) return;
    const csv = '﻿row,message\n' + result.errors.map((e) => `${e.row},"${e.message.replace(/"/g, '""')}"`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'import-errors.csv';
    a.click();
  };

  const step = !preview ? 0 : !result || result.dryRun ? 1 : 2;
  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <SectionCard icon={Users} tone={2} title={t('title')} description={t('hint')} className="self-start" bodyClassName="flex flex-col gap-5 p-4 md:p-6">
      <Stepper steps={[t('steps.upload'), t('steps.mapping'), t('steps.done')]} current={step} className="rounded-2xl bg-surface-2 p-3" />
      {!preview ? (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void upload(f);
            }}
            className={cn(
              'relative flex flex-col items-center gap-3 overflow-hidden rounded-card border-2 border-dashed px-6 py-12 text-center transition-all duration-200',
              dragging ? 'border-primary bg-primary-soft/60 shadow-ring' : 'border-border-strong bg-surface-2/60 hover:border-primary/60',
            )}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 crm-wash opacity-80" />
            <span className="relative grid size-16 place-items-center rounded-3xl bg-surface text-primary shadow-md ring-1 ring-border" aria-hidden>
              <UploadCloud className="size-8" strokeWidth={1.8} />
            </span>
            <div className="relative">
              <p className="text-[18px] font-semibold">{t('dropTitle')}</p>
              <p className="mt-1 text-[14px] text-muted">{t('uploadHint')}</p>
            </div>
            <div className="relative flex flex-wrap justify-center gap-2">
              <Pill tone={1} icon={FileSpreadsheet}>XLSX</Pill>
              <Pill tone={2} icon={Sheet}>CSV</Pill>
            </div>
            <Button className="relative mt-1" loading={busy === 'upload'} icon={<Upload className="size-4" strokeWidth={2} />} onClick={() => fileRef.current?.click()}>
              {t('upload')}
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
          </div>
          <form
            className="flex flex-col gap-2 rounded-2xl border border-border p-3 sm:flex-row sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy('sheets');
              try {
                accept(await apiFetch<ImportPreview>('/crm/imports/sheets', { method: 'POST', body: { url: sheetUrl }, orgId: org.id }));
              } catch (err) {
                toast({ title: errorMessage(err), tone: 'danger' });
              } finally {
                setBusy(null);
              }
            }}
          >
            <Field label={t('sheets')} className="flex-1">
              <Input type="url" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" prefixIcon={<Link2 className="size-4" strokeWidth={2} aria-hidden />} />
            </Field>
            <Button type="submit" variant="secondary" loading={busy === 'sheets'} disabled={!sheetUrl}>
              {t('sheetsLoad')}
            </Button>
          </form>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <IconTile icon={FileSpreadsheet} tone={1} />
              <div className="min-w-0">
                <div className="truncate font-semibold">{preview.fileName}</div>
                <div className="text-[13px] text-muted tabular">
                  {t('rows', { n: preview.rowsTotal })} · {t('mapped', { n: mappedCount, total: preview.headers.length })}
                </div>
              </div>
            </div>
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" strokeWidth={2} />} onClick={() => { setPreview(null); setResult(null); }}>
              {t('restart')}
            </Button>
          </div>
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
              <ListChecks className="size-4 text-muted" strokeWidth={2} aria-hidden />
              {t('mapping')}
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {preview.headers.map((h) => (
                <div key={h} className={cn('flex items-center gap-2 rounded-2xl border p-2 pl-3 transition-colors', mapping[h] ? 'border-primary/30 bg-primary-soft/30' : 'border-border')}>
                  <Field label={h} className="min-w-0 flex-1 [&_label]:truncate">
                    <Select value={mapping[h] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value as ImportField | '' }))} placeholder={t('skip')} options={IMPORT_FIELDS.map((f) => ({ value: f, label: IMPORT_FIELD_LABELS_KA[f] }))} />
                  </Field>
                  {mapping[h] ? <CheckCircle2 className="size-5 shrink-0 text-success" strokeWidth={2} aria-hidden /> : <ArrowRight className="size-5 shrink-0 text-border-strong" strokeWidth={2} aria-hidden />}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-[15px] font-semibold">{t('preview')}</h3>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-small tabular">
                <thead>
                  <tr className="bg-surface-2">
                    {preview.headers.map((h) => (
                      <th key={h} scope="col" className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-muted">
                        {h}
                        {mapping[h] ? <span className="ml-1.5 rounded-full bg-primary-soft px-2 py-0.5 text-[11.5px] font-semibold text-primary-soft-text">{IMPORT_FIELD_LABELS_KA[mapping[h] as ImportField]}</span> : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      {preview.headers.map((h, j) => (
                        <td key={h} className={`whitespace-nowrap px-3 py-2 ${mapping[h] ? '' : 'text-muted'}`}>{r[j]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" loading={busy === 'dry'} icon={<ListChecks className="size-4" strokeWidth={2} />} onClick={() => run(true)}>{t('check')}</Button>
            <Button loading={busy === 'run'} icon={<Upload className="size-4" strokeWidth={2} />} onClick={() => run(false)}>{t('run')}</Button>
          </div>
          {result && (
            <div role="status" aria-live="polite" className={cn('flex flex-col gap-3 rounded-2xl border p-4', result.errors.length ? 'border-accent/40 bg-accent-soft/50' : 'border-success/30 bg-success/5')}>
              <div className="flex items-center gap-3">
                <IconTile icon={result.errors.length ? CircleAlert : CheckCircle2} tone={result.errors.length ? 3 : 'success'} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular">{t(result.dryRun ? 'dryResult' : 'result', { ok: result.rowsImported, total: result.rowsTotal })}</p>
                  <Progress className="mt-2" value={result.rowsTotal ? (result.rowsImported / result.rowsTotal) * 100 : 0} tone={result.errors.length ? 3 : 'success'} label={t(result.dryRun ? 'dryResult' : 'result', { ok: result.rowsImported, total: result.rowsTotal })} />
                </div>
              </div>
              {result.errors.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold">{t('errors')}</h3>
                    <Button size="sm" variant="ghost" icon={<Download className="size-3.5" strokeWidth={2} />} onClick={downloadErrors}>{t('downloadErrors')}</Button>
                  </div>
                  <Table rows={result.errors} rowKey={(e) => `${e.row}-${e.message}`} columns={[{ key: 'row', header: t('row'), align: 'right', cell: (e) => <span className="tabular">{e.row}</span> }, { key: 'message', header: t('message'), cell: (e) => <span className="text-danger">{e.message}</span> }]} />
                </>
              )}
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}

const EXPORT_META: Record<string, { icon: LucideIcon; tone: Tone }> = { contacts: { icon: Users, tone: 2 }, deals: { icon: SquareKanban, tone: 1 }, tasks: { icon: SquareCheckBig, tone: 4 } };

function ExportCard() {
  const t = useTranslations('data.export');
  const toast = useToast();
  return (
    <SectionCard icon={FileDown} tone={1} title={t('title')} description={t('hint')} bodyClassName="flex flex-col gap-2 p-3 md:p-4">
      {EXPORT_ENTITIES.map((e) => {
        const meta = EXPORT_META[e] ?? { icon: FileSpreadsheet, tone: 8 as Tone };
        return (
          <div key={e} className="flex items-center gap-3 rounded-2xl border border-border p-2.5 transition-colors hover:bg-surface-2/60">
            <IconTile icon={meta.icon} tone={meta.tone} size="sm" />
            <span className="min-w-0 flex-1 truncate font-medium">{t(e)}</span>
            <span className="flex gap-1.5">
              {(['xlsx', 'csv'] as const).map((f) => (
                <Button key={f} size="sm" variant="secondary" className="h-8 rounded-full px-3" aria-label={`${t(e)} — ${f.toUpperCase()}`} icon={<Download className="size-3.5" strokeWidth={2} />} onClick={() => downloadFile(`/crm/exports/${e}.${f}`, `${e}.${f}`).catch((err) => toast({ title: errorMessage(err), tone: 'danger' }))}>
                  {f.toUpperCase()}
                </Button>
              ))}
            </span>
          </div>
        );
      })}
    </SectionCard>
  );
}

function ImportHistory() {
  const t = useTranslations('data.history');
  const { data } = useApi<ImportRow[]>('/crm/imports');
  return (
    <SectionCard icon={History} tone={4} title={t('title')} bodyClassName="p-3 md:p-4">
      {!data ? (
        <Skeleton className="h-24" />
      ) : data.length === 0 ? (
        <EmptyHint icon={History} title={t('empty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-surface-2/70 p-3">
              <IconTile icon={FileSpreadsheet} tone={r.status === 'failed' ? 'danger' : r.status === 'done' ? 'success' : 8} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{r.fileName}</div>
                <div className="text-[12.5px] text-muted tabular">{formatDateTimeKa(r.createdAt)}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Progress value={r.rowsTotal ? (r.rowsImported / r.rowsTotal) * 100 : 0} tone={r.status === 'failed' ? 'danger' : 'success'} label={`${t('imported')}: ${r.rowsImported}/${r.rowsTotal}`} />
                  <span className="shrink-0 text-[12.5px] font-semibold tabular">
                    {r.rowsImported}/{r.rowsTotal}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Pill size="sm" dot tone={r.status === 'done' ? 'success' : r.status === 'failed' ? 'danger' : 3}>
                  {t(`statuses.${r.status}`)}
                </Pill>
                {!!r.errors?.length && <span className="text-[12px] text-danger tabular">{t('errorsCount', { n: r.errors.length })}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
