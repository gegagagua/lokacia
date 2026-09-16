'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { PASSPORT_FIELD_BY_KEY, type ListingDetail, type PassportKey, type SessionUser } from '@lokacia/contracts';
import { Button, cn, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';
import { AccountPageHeader } from '../page-header';
import { ListingStatusBadge } from '../status-badges';
import { StepDescribe } from './step-describe';
import { StepLocation } from './step-location';
import { StepMedia } from './step-media';
import { StepPassport } from './step-passport';
import { StepPrice } from './step-price';
import { StepReview, type ReviewIssue } from './step-review';
import { StepType } from './step-type';
import {
  canCreate, emptyForm, formFromDetail, missingRequired, money, parseNum, STEP_KEYS, toPayload,
  type BusinessTypeOption, type ExistingListing, type ListingPayload, type StepKey, type WizardForm,
} from './types';
import { OwnerVerification } from './verification';

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: Date } | { kind: 'local' } | { kind: 'error'; message: string };
const pad = (n: number) => String(n).padStart(2, '0');

export function ListingWizard({ user, types, detail, initialStep }: { user: SessionUser; types: BusinessTypeOption[]; detail: (ListingDetail & { rejectReason?: string | null }) | null; initialStep?: string }) {
  const t = useTranslations('wizard');
  const ts = useTranslations('wizard.steps');
  const toast = useToast();
  const router = useRouter();
  const storageKey = `lk-wizard-draft:${user.id}`;

  const [form, setForm] = React.useState<WizardForm>(() => (detail ? formFromDetail(detail) : emptyForm()));
  const [existing, setExisting] = React.useState<ExistingListing | null>(detail ? { id: detail.id, slug: detail.slug, status: detail.status, rejectReason: detail.rejectReason ?? null, isOwner: detail.isOwner } : null);
  const [step, setStep] = React.useState<number>(() => Math.max(0, STEP_KEYS.indexOf((initialStep ?? 'type') as StepKey)));
  const [reached, setReached] = React.useState<number>(() => (detail ? STEP_KEYS.length - 1 : Math.max(0, STEP_KEYS.indexOf((initialStep ?? 'type') as StepKey))));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [save, setSave] = React.useState<SaveState>({ kind: 'idle' });
  const [restored, setRestored] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const lastSaved = React.useRef<Record<string, string>>({});
  const dirty = React.useRef(false);
  const saving = React.useRef<Promise<string | null> | null>(null);
  const headingRef = React.useRef<HTMLDivElement>(null);
  const isEdit = !!existing;
  const key = STEP_KEYS[step]!;

  const snapshot = React.useCallback((p: ListingPayload) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, JSON.stringify(v)])), []);

  // baseline for diffs in edit mode; restore local draft in create mode
  React.useEffect(() => {
    if (detail) {
      lastSaved.current = snapshot(toPayload(formFromDetail(detail), types));
      // the page may re-render from the server (router refresh) while edits are still unsaved: restore them
      try {
        const raw = sessionStorage.getItem(`lk-wizard-edit:${detail.id}`);
        const saved = raw ? (JSON.parse(raw) as { form: WizardForm; at: number }) : null;
        if (saved?.form && Date.now() - saved.at < 30 * 60_000) {
          dirty.current = true;
          setForm({ ...saved.form, media: saved.form.media.filter((m) => !m.id.startsWith('tmp-')) });
        }
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { form: WizardForm };
        if (saved.form) {
          setForm({ ...emptyForm(), ...saved.form, media: (saved.form.media ?? []).filter((m) => !m.id.startsWith('tmp-')) });
          setRestored(true);
        }
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = React.useCallback((p: Partial<WizardForm>) => {
    dirty.current = true;
    setForm((f) => ({ ...f, ...p }));
  }, []);
  const update = React.useCallback((fn: (f: WizardForm) => Partial<WizardForm>) => {
    dirty.current = true;
    setForm((f) => ({ ...f, ...fn(f) }));
  }, []);

  const formRef = React.useRef(form);
  formRef.current = form;
  const existingRef = React.useRef(existing);
  existingRef.current = existing;
  const stepRef = React.useRef(step);
  stepRef.current = step;

  const replaceUrl = React.useCallback((id: string, s: StepKey) => {
    window.history.replaceState(null, '', `/account/listings/${id}/edit?step=${s}`);
  }, []);

  /** Persists the draft: localStorage until the minimum is filled, then POST once and PATCH only changed keys. */
  const persist = React.useCallback(async (): Promise<string | null> => {
    if (saving.current) await saving.current.catch(() => null);
    const run = (async () => {
      const f = formRef.current;
      const payload = toPayload(f, types);
      const existing = existingRef.current;
      if (!existing) {
        if (!canCreate(payload)) {
          try {
            localStorage.setItem(storageKey, JSON.stringify({ form: f, at: Date.now() }));
          } catch {
            /* storage unavailable */
          }
          setSave({ kind: 'local' });
          return null;
        }
        setSave({ kind: 'saving' });
        const created = await apiFetch<ListingDetail>('/listings', { method: 'POST', body: { ...payload, submit: false }, orgId: f.orgId });
        lastSaved.current = snapshot(payload);
        existingRef.current = { id: created.id, slug: created.slug, status: created.status, rejectReason: null, isOwner: created.isOwner };
        setExisting(existingRef.current);
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
        replaceUrl(created.id, STEP_KEYS[stepRef.current]!);
        setSave({ kind: 'saved', at: new Date() });
        return created.id;
      }
      const snap = snapshot(payload);
      const changed = Object.fromEntries(Object.entries(payload).filter(([k]) => snap[k] !== lastSaved.current[k]));
      // incomplete required values can't be PATCHed (server validation); keep them for later
      for (const k of ['title', 'address', 'lat', 'lng', 'areaM2', 'priceMinor'] as const) {
        const v = changed[k];
        if (k in changed && (v == null || (typeof v === 'string' && v.length < (k === 'title' ? 5 : 3)))) delete changed[k];
      }
      if (!Object.keys(changed).length) {
        setSave((s) => (s.kind === 'saving' ? { kind: 'saved', at: new Date() } : s));
        return existing.id;
      }
      setSave({ kind: 'saving' });
      const updated = await apiFetch<ListingDetail>(`/listings/${existing.id}`, { method: 'PATCH', body: changed });
      for (const k of Object.keys(changed)) lastSaved.current[k] = snap[k]!;
      setExisting((e) => (e ? { ...e, status: updated.status } : e));
      setSave({ kind: 'saved', at: new Date() });
      return existing.id;
    })();
    saving.current = run;
    try {
      return await run;
    } catch (e) {
      const message = e instanceof ClientApiError ? (e.problem?.errors?.[0] ? `${e.problem.title} (${e.problem.errors[0].path})` : e.message) : String(e);
      setSave({ kind: 'error', message });
      throw e;
    } finally {
      if (saving.current === run) saving.current = null;
    }
  }, [replaceUrl, snapshot, storageKey, types]);

  // unsaved edits survive a server re-render of the edit route
  React.useEffect(() => {
    if (!dirty.current || !existing) return;
    try {
      sessionStorage.setItem(`lk-wizard-edit:${existing.id}`, JSON.stringify({ form, at: Date.now() }));
    } catch {
      /* ignore */
    }
  }, [form, existing]);

  // autosave ~2s after the last change
  React.useEffect(() => {
    if (!dirty.current) return;
    const id = setTimeout(() => void persist().catch(() => undefined), 2000);
    return () => clearTimeout(id);
  }, [form, persist]);

  const validate = React.useCallback(
    (k: StepKey, f: WizardForm): Record<string, string> => {
      const e: Record<string, string> = {};
      if (k === 'type' && !f.businessTypes.length) e.businessTypes = t('type.errorTypes');
      if (k === 'location') {
        if (f.lat == null || f.lng == null) e.pin = t('location.errorPin');
        if (f.address.trim().length < 3) e.address = t('location.errorAddress');
        if (!((parseNum(f.areaM2) ?? 0) > 0)) e.areaM2 = t('location.errorArea');
      }
      if (k === 'passport') {
        const miss = missingRequired(f, types);
        for (const m of miss) e[`passport.${m}`] = t('passport.required');
        if (miss.length) e.passport = t('passport.errorRequired', { fields: miss.map((m) => PASSPORT_FIELD_BY_KEY[m].labelKa).join(', ') });
      }
      if (k === 'price' && !((money(f.price) ?? 0) > 0)) e.price = t('price.errorPrice');
      if (k === 'describe' && f.title.trim().length < 5) e.title = t('describe.errorTitle');
      return e;
    },
    [t, types],
  );

  const issues: ReviewIssue[] = (['type', 'location', 'passport', 'price', 'describe'] as const).flatMap((s) => {
    const e = validate(s, form);
    const msgs = Object.entries(e).filter(([k]) => !(s === 'passport' && k.startsWith('passport.')));
    return msgs.map(([, message]) => ({ step: s, message }));
  });

  const goTo = (i: number) => {
    const n = Math.max(0, Math.min(STEP_KEYS.length - 1, i));
    setStep(n);
    setReached((r) => Math.max(r, n));
    setErrors({});
    if (existing) replaceUrl(existing.id, STEP_KEYS[n]!);
    requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
      headingRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  };

  const next = () => {
    const e = validate(key, form);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    if (key === 'describe' || key === 'price') void persist().catch(() => undefined);
    goTo(step + 1);
  };

  const saveNow = async () => {
    try {
      const id = await persist();
      toast({ title: id ? t('review.saved') : t('save.local'), tone: id ? 'success' : 'default' });
    } catch {
      toast({ title: t('save.error', { message: '' }), tone: 'danger' });
    }
  };

  const submit = async () => {
    if (issues.length) {
      goTo(STEP_KEYS.indexOf(issues[0]!.step));
      setErrors(validate(issues[0]!.step, form));
      return;
    }
    setSubmitting(true);
    try {
      const id = await persist();
      if (!id) throw new Error('not saved');
      const status = existing?.status ?? 'draft';
      if (['draft', 'rejected'].includes(status)) {
        await apiFetch(`/listings/${id}/status`, { method: 'POST', body: { status: 'pending_review' } });
        toast({ title: t('review.submitted'), tone: 'success' });
      } else toast({ title: t('review.saved'), tone: 'success' });
      try {
        sessionStorage.removeItem(`lk-wizard-edit:${id}`);
      } catch {
        /* ignore */
      }
      router.push('/account/listings');
      router.refresh();
    } catch (e) {
      if (e instanceof ClientApiError && e.problem?.type.endsWith('/passport-incomplete')) {
        const errs: Record<string, string> = {};
        for (const er of e.problem.errors ?? []) errs[er.path] = er.message;
        const keys = (e.problem.errors ?? []).map((er) => er.path.replace('passport.', '') as PassportKey);
        errs.passport = t('passport.errorRequired', { fields: keys.map((k) => PASSPORT_FIELD_BY_KEY[k]?.labelKa ?? k).join(', ') });
        setStep(STEP_KEYS.indexOf('passport'));
        setErrors(errs);
      } else toast({ title: e instanceof ClientApiError ? e.message : t('save.error', { message: '' }), tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const discardLocal = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    dirty.current = false;
    setForm(emptyForm());
    setRestored(false);
    setSave({ kind: 'idle' });
    setStep(0);
    setReached(0);
  };

  const status = existing?.status;
  const canResubmit = !status || status === 'draft' || status === 'rejected';
  const saveText =
    save.kind === 'saving' ? t('save.saving') : save.kind === 'saved' ? t('save.saved', { time: `${pad(save.at.getHours())}:${pad(save.at.getMinutes())}` }) : save.kind === 'local' ? t('save.local') : save.kind === 'error' ? t('save.error', { message: save.message }) : '';

  return (
    <div>
      <AccountPageHeader
        back={
          <Link href="/account/listings" className="text-link underline-offset-4 hover:underline">
            {t('backToListings')}
          </Link>
        }
        title={isEdit && detail ? t('titleEdit') : t('titleNew')}
        description={isEdit && detail ? t('descriptionEdit') : t('descriptionNew')}
        actions={
          existing && status && status !== 'draft' ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/listings/${existing.slug}`}>{t('actions.viewListing')}</Link>
            </Button>
          ) : undefined
        }
      />

      {(status || restored) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-small">
          {status && (
            <>
              <span className="text-muted">{t('status.label')}:</span>
              <ListingStatusBadge status={status} />
            </>
          )}
          {existing?.rejectReason && status === 'rejected' && <span className="w-full text-danger">{t('status.rejectReason', { reason: existing.rejectReason })}</span>}
          {restored && !existing && (
            <span className="flex items-center gap-2 text-muted">
              {t('save.restored')}
              <Button variant="link" size="sm" onClick={discardLocal}>
                {t('save.discard')}
              </Button>
            </span>
          )}
        </div>
      )}

      <nav aria-label={t('stepNav')} className="-mx-4 mb-6 overflow-x-auto px-4">
        <ol className="flex min-w-max items-center gap-1.5 sm:min-w-0">
          {STEP_KEYS.map((s, i) => {
            const state = i === step ? 'current' : i <= reached ? 'done' : 'todo';
            return (
              <li key={s} className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={i > reached}
                  onClick={() => goTo(i)}
                  aria-current={state === 'current' ? 'step' : undefined}
                  className={cn('flex h-9 items-center gap-2 whitespace-nowrap rounded-button px-2 text-small transition-colors disabled:cursor-not-allowed', state === 'current' ? 'bg-surface-2 font-medium' : 'hover:bg-surface-2', state === 'todo' && 'text-muted')}
                >
                  <span className={cn('grid size-6 shrink-0 place-items-center rounded-full border text-[12px] tabular', state === 'current' && 'border-primary text-primary', state === 'done' && 'border-primary bg-primary text-primary-contrast', state === 'todo' && 'border-border-strong')}>
                    {state === 'done' ? <Check className="size-3.5" strokeWidth={2} aria-hidden /> : i + 1}
                  </span>
                  <span className={cn(state === 'current' ? 'inline' : 'hidden md:inline')}>{ts(s)}</span>
                </button>
                {i < STEP_KEYS.length - 1 && <span aria-hidden className={cn('h-px w-3 sm:w-5', i < reached ? 'bg-primary' : 'bg-border-strong')} />}
              </li>
            );
          })}
        </ol>
      </nav>

      <div ref={headingRef} tabIndex={-1} className="scroll-mt-24 outline-none">
        <p className="mb-3 text-small text-muted">{t('stepOf', { current: step + 1, total: STEP_KEYS.length })}</p>
        {key === 'type' && <StepType form={form} set={set} types={types} user={user} isEdit={isEdit} errors={errors} />}
        {key === 'location' && <StepLocation form={form} set={set} errors={errors} />}
        {key === 'passport' && <StepPassport form={form} update={update} types={types} errors={errors} />}
        {key === 'media' && <StepMedia form={form} update={update} listingId={existing?.id ?? null} errors={errors} />}
        {key === 'price' && <StepPrice form={form} set={set} types={types} user={user} listingId={existing?.id ?? null} errors={errors} />}
        {key === 'describe' && <StepDescribe form={form} set={set} types={types} errors={errors} />}
        {key === 'review' && (
          <StepReview form={form} types={types} issues={issues} goTo={(s) => goTo(STEP_KEYS.indexOf(s))}>
            {(existing ? existing.isOwner : form.isOwner && !form.orgId) && <OwnerVerification listingId={existing?.id ?? null} />}
          </StepReview>
        )}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-bg/85">
        <div className="flex flex-wrap items-center gap-2">
          {step > 0 && (
            <Button variant="ghost" onClick={() => goTo(step - 1)}>
              {t('actions.back')}
            </Button>
          )}
          <span className={cn('order-last w-full text-small sm:order-none sm:w-auto sm:flex-1', save.kind === 'error' ? 'text-danger' : 'text-muted')} aria-live="polite">
            {saveText}
          </span>
          <Button variant="secondary" onClick={() => void saveNow()} className="ml-auto sm:ml-0">
            {isEdit && status !== 'draft' ? t('actions.saveChanges') : t('actions.saveDraft')}
          </Button>
          {key !== 'review' ? (
            <Button onClick={next}>{t('actions.next')}</Button>
          ) : (
            <Button onClick={() => void submit()} loading={submitting}>
              {canResubmit ? (status === 'rejected' ? t('actions.resubmit') : t('actions.publish')) : t('actions.saveChanges')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
