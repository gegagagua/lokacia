'use client';
import * as React from 'react';
import Link, { useLocalizedPath } from '@/i18n/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Banknote, Check, ClipboardCheck, ClipboardList, CloudCheck, ExternalLink, HardDrive, History, Images, LayoutGrid, Loader2, MapPin, PenLine, Save, Send, TriangleAlert } from 'lucide-react';
import { PASSPORT_FIELD_BY_KEY, type ListingDetail, type PassportKey, type SessionUser } from '@lokacia/contracts';
import { Button, cn, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';
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

const STEP_ICONS: Record<StepKey, typeof Check> = { type: LayoutGrid, location: MapPin, passport: ClipboardList, media: Images, price: Banknote, describe: PenLine, review: ClipboardCheck };

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: Date } | { kind: 'local' } | { kind: 'error'; message: string };
const pad = (n: number) => String(n).padStart(2, '0');

export function ListingWizard({ user, types, detail, initialStep }: { user: SessionUser; types: BusinessTypeOption[]; detail: (ListingDetail & { rejectReason?: string | null }) | null; initialStep?: string }) {
  const t = useTranslations('wizard');
  const ts = useTranslations('wizard.steps');
  const td = useTranslations('wizard.describe');
  const fmt = useFormat();
  const lp = useLocalizedPath();
  const titleLabels = React.useMemo(() => ({ fallback: td('defaultTitle'), areaUnit: fmt.areaUnit }), [td, fmt]);
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
      lastSaved.current = snapshot(toPayload(formFromDetail(detail), types, titleLabels));
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
    window.history.replaceState(null, '', lp(`/account/listings/${id}/edit?step=${s}`));
  }, [lp]);

  /** Persists the draft: localStorage until the minimum is filled, then POST once and PATCH only changed keys. */
  const persist = React.useCallback(async (): Promise<string | null> => {
    if (saving.current) await saving.current.catch(() => null);
    const run = (async () => {
      const f = formRef.current;
      const payload = toPayload(f, types, titleLabels);
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
  }, [replaceUrl, snapshot, storageKey, types, titleLabels]);

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
      router.push(lp('/account/listings'));
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

  const progress = Math.round(((step + 1) / STEP_KEYS.length) * 100);

  return (
    <div>
      <AccountPageHeader
        back={
          <Link href="/account/listings" className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-muted shadow-xs ring-1 ring-border transition-colors hover:text-text">
            {t('backToListings')}
          </Link>
        }
        title={isEdit && detail ? t('titleEdit') : t('titleNew')}
        description={isEdit && detail ? t('descriptionEdit') : t('descriptionNew')}
        actions={
          existing && status && status !== 'draft' ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/listings/${existing.slug}`}>
                <ExternalLink className="size-4" strokeWidth={2} aria-hidden />
                {t('actions.viewListing')}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {(status || restored) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-small">
          {status && (
            <span className="inline-flex items-center gap-2 rounded-full bg-surface py-1 pl-3 pr-1 shadow-xs ring-1 ring-border">
              <span className="text-muted">{t('status.label')}</span>
              <ListingStatusBadge status={status} />
            </span>
          )}
          {existing?.rejectReason && status === 'rejected' && (
            <p className="flex w-full items-start gap-2 rounded-2xl bg-danger/10 px-4 py-3 font-medium text-danger">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
              {t('status.rejectReason', { reason: existing.rejectReason })}
            </p>
          )}
          {restored && !existing && (
            <span className="inline-flex flex-wrap items-center gap-2 rounded-full bg-link/10 py-1 pl-3 pr-1 text-link">
              <History className="size-4" strokeWidth={2} aria-hidden />
              {t('save.restored')}
              <Button variant="ghost" size="sm" className="h-7 rounded-full bg-surface px-3 text-text" onClick={discardLocal}>
                {t('save.discard')}
              </Button>
            </span>
          )}
        </div>
      )}

      <nav aria-label={t('stepNav')} className="card mb-6 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <span className="text-[13px] font-semibold text-muted">{t('stepOf', { current: step + 1, total: STEP_KEYS.length })}</span>
          <span className="text-[13px] font-bold tabular text-primary-soft-text">{progress}%</span>
        </div>
        <div className="mx-1 mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--primary-500))] transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <ol className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          {STEP_KEYS.map((s, i) => {
            const state = i === step ? 'current' : i <= reached ? 'done' : 'todo';
            const Icon = STEP_ICONS[s];
            return (
              <li key={s} className="min-w-0 shrink-0 md:flex-1">
                <button
                  type="button"
                  disabled={i > reached}
                  onClick={() => goTo(i)}
                  aria-current={state === 'current' ? 'step' : undefined}
                  className={cn(
                    'flex h-11 w-full items-center gap-2 rounded-xl px-2.5 text-[14px] font-semibold transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none disabled:cursor-not-allowed md:h-auto md:flex-col md:gap-1.5 md:px-1 md:py-2 md:text-[12.5px] md:leading-tight',
                    state === 'current' ? 'bg-primary-soft text-primary-soft-text' : state === 'done' ? 'text-text hover:bg-surface-2' : 'text-muted',
                  )}
                >
                  <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-[12px] tabular transition-colors md:size-8', state === 'current' && 'bg-primary text-primary-contrast shadow-sm', state === 'done' && 'bg-success/15 text-success', state === 'todo' && 'bg-surface-2 text-muted')}>
                    {state === 'done' ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : state === 'current' ? <Icon className="size-3.5" strokeWidth={2.25} aria-hidden /> : i + 1}
                  </span>
                  <span className={cn(state === 'current' ? 'inline whitespace-nowrap' : 'hidden', 'md:line-clamp-2 md:block md:whitespace-normal md:text-center')}>{ts(s)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div ref={headingRef} tabIndex={-1} className="scroll-mt-24 outline-none">
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

      <div className="sticky bottom-3 z-20 mt-6">
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface/95 p-2.5 shadow-lg backdrop-blur-xl sm:p-3">
          {step > 0 && (
            <Button variant="ghost" onClick={() => goTo(step - 1)} icon={<ArrowLeft className="size-4" strokeWidth={2} aria-hidden />}>
              <span className="hidden sm:inline">{t('actions.back')}</span>
              <span className="sr-only sm:hidden">{t('actions.back')}</span>
            </Button>
          )}
          <span className={cn('order-last flex w-full items-center gap-2 px-2 text-[13px] sm:order-none sm:w-auto sm:flex-1', save.kind === 'error' ? 'text-danger' : 'text-muted')} aria-live="polite">
            {save.kind === 'saving' ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden /> : save.kind === 'saved' ? <CloudCheck className="size-4 text-success" strokeWidth={2} aria-hidden /> : save.kind === 'error' ? <TriangleAlert className="size-4" strokeWidth={2} aria-hidden /> : save.kind === 'local' ? <HardDrive className="size-4" strokeWidth={2} aria-hidden /> : null}
            <span className="line-clamp-2">{saveText}</span>
          </span>
          <Button variant="secondary" onClick={() => void saveNow()} className="ml-auto sm:ml-0" icon={<Save className="size-4" strokeWidth={2} aria-hidden />}>
            <span className="hidden sm:inline">{isEdit && status !== 'draft' ? t('actions.saveChanges') : t('actions.saveDraft')}</span>
            <span className="sr-only sm:hidden">{isEdit && status !== 'draft' ? t('actions.saveChanges') : t('actions.saveDraft')}</span>
          </Button>
          {key !== 'review' ? (
            <Button onClick={next}>
              {t('actions.next')}
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
            </Button>
          ) : (
            <Button variant="accent" onClick={() => void submit()} loading={submitting} icon={<Send className="size-4" strokeWidth={2} aria-hidden />}>
              {canResubmit ? (status === 'rejected' ? t('actions.resubmit') : t('actions.publish')) : t('actions.saveChanges')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
