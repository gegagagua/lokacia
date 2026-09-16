'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Check, CircleCheck, CircleX, FileSignature, FileText, ShieldCheck } from 'lucide-react';
import { formatDateKa } from '@lokacia/contracts';
import { Button, Checkbox, cn, EmptyState, Field, Input, Logo, Skeleton, useToast } from '@lokacia/ui';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { OrgBrandMark, validBrand } from '../../brand';

type SignDoc = { title: string; version: number; org: { name: string; logoUrl: string | null; brandColor: string | null }; text: string; signStatus: 'draft' | 'sent' | 'signed' | 'declined'; signedAt: string | null; signerName: string | null };

/** Public e-sign page (MockESign adapter link: CRM_URL/sign/:ref). */
export function SignView({ signRef }: { signRef: string }) {
  const t = useTranslations('documents.sign');
  const toast = useToast();
  const { data, error, mutate } = useSWR(`/crm/documents/sign/${signRef}`, (p: string) => apiFetch<SignDoc>(p, { noOrg: true }));
  const [agree, setAgree] = React.useState(false);
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState<'sign' | 'decline' | null>(null);
  const decide = async (decision: 'sign' | 'decline') => {
    setBusy(decision);
    try {
      await apiFetch(`/crm/documents/sign/${signRef}`, { method: 'POST', body: { decision, name }, noOrg: true });
      await mutate();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  if (error)
    return (
      <div className="drawing-grid grid min-h-dvh place-items-center px-4">
        <div className="flex w-full max-w-md flex-col items-center gap-5">
          <Logo />
          <EmptyState title={t('notFound')} className="w-full border-solid bg-surface shadow-md" />
        </div>
      </div>
    );

  const brand = validBrand(data?.org.brandColor);
  const done = data?.signStatus === 'signed';
  const step = done ? 3 : !agree ? 0 : name.trim().length < 2 ? 1 : 2;
  const steps = [t('stepRead'), t('stepConfirm'), t('stepSign')];

  return (
    <div className="crm-wash min-h-dvh">
      <header className="glass sticky top-0 z-30 border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            {data ? <OrgBrandMark name={data.org.name} logoUrl={data.org.logoUrl} brand={brand} size={36} /> : <Skeleton className="size-9 rounded-xl" />}
            <span className="truncate text-[17px] font-bold tracking-tight">{data?.org.name}</span>
          </div>
          <Logo size={20} showGeorgian={false} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8 md:py-12">
        {!data ? (
          <Skeleton className="h-[480px] rounded-card" />
        ) : (
          <>
            <div className="card p-5 md:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text" aria-hidden>
                  <FileSignature className="size-7" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="text-[26px] font-bold leading-tight tracking-tight md:text-[32px] md:leading-[40px]">{data.title}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-7 items-center rounded-full bg-surface-2 px-2.5 text-[12.5px] font-semibold text-muted ring-1 ring-inset ring-border tabular">{t('version', { version: data.version })}</span>
                    {data.signStatus === 'sent' && (
                      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-[12.5px] font-semibold text-text">
                        <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                        {t('statusSent')}
                      </span>
                    )}
                    {data.signStatus === 'signed' && (
                      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-success/12 px-2.5 text-[12.5px] font-semibold text-success">
                        <Check className="size-3.5" strokeWidth={2.4} aria-hidden />
                        {t('signed')}
                      </span>
                    )}
                    {data.signStatus === 'declined' && <span className="inline-flex h-7 items-center rounded-full bg-danger/10 px-2.5 text-[12.5px] font-semibold text-danger">{t('declined')}</span>}
                    <span className="text-[12.5px] text-muted">{t('demo')}</span>
                  </div>
                </div>
              </div>

              {data.signStatus !== 'draft' && data.signStatus !== 'declined' && (
                <ol aria-label={t('steps')} className="mt-6 grid grid-cols-3 gap-2">
                  {steps.map((s, i) => {
                    const state = i < step ? 'done' : i === step ? 'current' : 'todo';
                    return (
                      <li key={s} aria-current={state === 'current' ? 'step' : undefined} className="flex min-w-0 flex-col gap-2">
                        <span className={cn('h-1.5 rounded-full transition-colors duration-300', state === 'done' ? 'bg-primary' : state === 'current' ? 'bg-accent' : 'bg-surface-3')} aria-hidden />
                        <span className={cn('flex min-w-0 items-center gap-1.5 text-[13px] font-semibold', state === 'todo' ? 'text-muted' : 'text-text')}>
                          <span className={cn('grid size-5 shrink-0 place-items-center rounded-full text-[11px] tabular', state === 'done' ? 'bg-primary text-primary-contrast' : state === 'current' ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-muted')} aria-hidden>
                            {state === 'done' ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                          </span>
                          <span className="min-w-0 break-words text-[12px] leading-4 sm:text-[13px]">{s}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <section aria-labelledby="doc-text" className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-5 py-3">
                <FileText className="size-4 text-muted" strokeWidth={2} aria-hidden />
                <h2 id="doc-text" className="text-[14px] font-semibold">
                  {t('document')}
                </h2>
              </div>
              <div className="scrollbar-thin max-h-[56dvh] overflow-y-auto whitespace-pre-wrap px-5 py-6 text-[15.5px] leading-[1.8] md:px-10 md:py-8" tabIndex={0}>
                {data.text}
              </div>
            </section>

            {data.signStatus === 'signed' && (
              <div className="card flex items-center gap-4 border-success/40 bg-success/5 p-5">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-success text-surface shadow-sm" aria-hidden>
                  <CircleCheck className="size-6" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <div className="text-[17px] font-bold">{t('signed')}</div>
                  <div className="text-small text-muted tabular">
                    {data.signerName}
                    {data.signedAt ? ` · ${formatDateKa(data.signedAt)}` : ''}
                  </div>
                </div>
                {data.signerName && <span className="ml-auto hidden font-serif text-[26px] italic text-primary sm:block">{data.signerName}</span>}
              </div>
            )}
            {data.signStatus === 'declined' && (
              <div className="card flex items-center gap-4 border-danger/40 bg-danger/5 p-5">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-danger text-surface shadow-sm" aria-hidden>
                  <CircleX className="size-6" strokeWidth={2} />
                </span>
                <div className="text-[17px] font-bold">{t('declined')}</div>
              </div>
            )}
            {data.signStatus === 'draft' && <p className="card p-5 text-muted">{t('notAvailable')}</p>}
            {data.signStatus === 'sent' && (
              <section aria-labelledby="sign-title" className="card flex flex-col gap-5 p-5 md:p-7">
                <h2 id="sign-title" className="text-[18px] font-bold">
                  {t('signatureTitle')}
                </h2>
                <div className="rounded-2xl border border-border bg-surface-2/60 p-4">
                  <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} label={t('readConfirm')} />
                </div>
                <Field label={t('name')}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </Field>
                <div aria-hidden className="relative grid h-32 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-border-strong bg-surface">
                  <div className="absolute inset-x-8 bottom-8 h-px bg-border-strong" />
                  <span className="absolute bottom-3 left-8 text-[12px] text-muted">✕</span>
                  {name.trim() ? (
                    <span className="relative -mt-4 max-w-full truncate px-8 font-serif text-[34px] italic text-primary">{name.trim()}</span>
                  ) : (
                    <span className="relative -mt-4 px-6 text-center text-[14px] text-muted">{t('signaturePlaceholder')}</span>
                  )}
                </div>
                <p className="flex items-start gap-2 text-[13px] text-muted">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2} aria-hidden />
                  {t('secure')}
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="danger" onClick={() => decide('decline')} loading={busy === 'decline'} disabled={name.trim().length < 2}>
                    {t('decline')}
                  </Button>
                  <Button onClick={() => decide('sign')} loading={busy === 'sign'} disabled={!agree || name.trim().length < 2} icon={<FileSignature className="size-4" strokeWidth={2} aria-hidden />}>
                    {t('sign')}
                  </Button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
