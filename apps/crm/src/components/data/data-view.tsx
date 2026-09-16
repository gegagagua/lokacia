'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { EXPORT_ENTITIES, formatDateTimeKa, IMPORT_FIELD_LABELS_KA, IMPORT_FIELDS, type ImportField, type ImportPreview, type ImportResult } from '@lokacia/contracts';
import { Badge, Button, Card, Field, Input, Select, Skeleton, Table, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { apiFetch, downloadFile, errorMessage } from '@/lib/api-client';
import { Can, useCrm } from '@/lib/crm-context';
import { useApi } from '@/lib/swr';

type ImportRow = { id: string; fileName: string; status: 'pending' | 'done' | 'failed'; rowsTotal: number; rowsImported: number; errors: { row: number; message: string }[] | null; createdAt: string };

export function DataView() {
  const t = useTranslations('data');
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ImportWizard />
        <div className="flex flex-col gap-5">
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

  return (
    <Card className="flex flex-col gap-4 p-4 md:p-5">
      <h2 className="compact text-h3 font-semibold">{t('title')}</h2>
      {!preview ? (
        <>
          <div className="drawing-grid flex flex-col items-center gap-2 rounded-card border border-dashed border-border-strong px-4 py-8 text-center">
            <FileSpreadsheet className="size-6 text-muted" strokeWidth={1.5} aria-hidden />
            <Button loading={busy === 'upload'} icon={<Upload className="size-4" strokeWidth={1.5} />} onClick={() => fileRef.current?.click()}>
              {t('upload')}
            </Button>
            <p className="text-small text-muted">{t('uploadHint')}</p>
            <input ref={fileRef} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
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
              <Input type="url" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
            </Field>
            <Button type="submit" variant="secondary" loading={busy === 'sheets'} disabled={!sheetUrl}>
              {t('sheetsLoad')}
            </Button>
          </form>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-small text-muted">
              <span className="font-medium text-text">{preview.fileName}</span> · {t('rows', { n: preview.rowsTotal })}
            </div>
            <Button size="sm" variant="ghost" onClick={() => { setPreview(null); setResult(null); }}>
              {t('restart')}
            </Button>
          </div>
          <div>
            <h3 className="mb-2 text-[15px] font-medium">{t('mapping')}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {preview.headers.map((h) => (
                <Field key={h} label={h}>
                  <Select value={mapping[h] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value as ImportField | '' }))} placeholder={t('skip')} options={IMPORT_FIELDS.map((f) => ({ value: f, label: IMPORT_FIELD_LABELS_KA[f] }))} />
                </Field>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-[15px] font-medium">{t('preview')}</h3>
            <div className="overflow-x-auto rounded-card border border-border">
              <table className="w-full text-small tabular">
                <thead>
                  <tr className="border-b border-border-strong">
                    {preview.headers.map((h) => (
                      <th key={h} scope="col" className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-muted">
                        {h}
                        {mapping[h] ? <span className="ml-1 text-primary">→ {IMPORT_FIELD_LABELS_KA[mapping[h] as ImportField]}</span> : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {preview.headers.map((h, j) => (
                        <td key={h} className={`whitespace-nowrap px-2 py-1.5 ${mapping[h] ? '' : 'text-muted'}`}>{r[j]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" loading={busy === 'dry'} onClick={() => run(true)}>{t('check')}</Button>
            <Button loading={busy === 'run'} onClick={() => run(false)}>{t('run')}</Button>
          </div>
          {result && (
            <div role="status" aria-live="polite" className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="font-medium tabular">{t(result.dryRun ? 'dryResult' : 'result', { ok: result.rowsImported, total: result.rowsTotal })}</p>
              {result.errors.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-medium">{t('errors')}</h3>
                    <Button size="sm" variant="ghost" icon={<Download className="size-3.5" strokeWidth={1.5} />} onClick={downloadErrors}>{t('downloadErrors')}</Button>
                  </div>
                  <Table rows={result.errors} rowKey={(e) => `${e.row}-${e.message}`} columns={[{ key: 'row', header: t('row'), align: 'right', cell: (e) => <span className="tabular">{e.row}</span> }, { key: 'message', header: t('message'), cell: (e) => <span className="text-danger">{e.message}</span> }]} />
                </>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function ExportCard() {
  const t = useTranslations('data.export');
  const toast = useToast();
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="compact text-h3 font-semibold">{t('title')}</h2>
      <p className="text-small text-muted">{t('hint')}</p>
      <ul className="flex flex-col divide-y divide-border">
        {EXPORT_ENTITIES.map((e) => (
          <li key={e} className="flex items-center justify-between gap-2 py-2">
            <span>{t(e)}</span>
            <span className="flex gap-1.5">
              {(['xlsx', 'csv'] as const).map((f) => (
                <Button key={f} size="sm" variant="secondary" icon={<Download className="size-3.5" strokeWidth={1.5} />} onClick={() => downloadFile(`/crm/exports/${e}.${f}`, `${e}.${f}`).catch((err) => toast({ title: errorMessage(err), tone: 'danger' }))}>
                  {f.toUpperCase()}
                </Button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ImportHistory() {
  const t = useTranslations('data.history');
  const { data } = useApi<ImportRow[]>('/crm/imports');
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="compact text-h3 font-semibold">{t('title')}</h2>
      {!data ? (
        <Skeleton className="h-24" />
      ) : data.length === 0 ? (
        <p className="text-small text-muted">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {data.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-small">
              <span className="text-muted tabular">{formatDateTimeKa(r.createdAt)}</span>
              <span className="tabular">
                {r.rowsImported}/{r.rowsTotal}
                {r.errors?.length ? <span className="ml-1 text-danger">· {r.errors.length}</span> : null}
              </span>
              <Badge tone={r.status === 'done' ? 'success' : r.status === 'failed' ? 'danger' : 'outline'}>{r.status === 'done' ? '✓' : r.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
