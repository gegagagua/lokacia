'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Clock, Plus, Trash2 } from 'lucide-react';
import { renderSequenceTemplate, SEQUENCE_CHANNELS, SEQUENCE_TRIGGERS, type CrmSequence, type SequenceInput } from '@lokacia/contracts';
import { Button, cn, Dialog, Field, IconButton, Input, Select, Switch, Textarea, useToast } from '@lokacia/ui';
import { toneClass } from '@/components/common/ui';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApiMutation } from '@/lib/swr';
import { CHANNEL_META } from './channel';

type Step = SequenceInput['steps'][number] & { key: string };
const newKey = () => Math.random().toString(36).slice(2);

export function SequenceEditor({ open, onOpenChange, sequence, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; sequence: CrmSequence | null; onSaved: () => void }) {
  const t = useTranslations('sequences');
  const toast = useToast();
  const mutate = useApiMutation();
  const { user, workspace } = useCrm();
  const [name, setName] = React.useState('');
  const [trigger, setTrigger] = React.useState<SequenceInput['trigger']>('after_viewing');
  const [active, setActive] = React.useState(true);
  const [steps, setSteps] = React.useState<Step[]>([]);
  const [busy, setBusy] = React.useState(false);
  const areas = React.useRef<Record<string, HTMLTextAreaElement | null>>({});

  React.useEffect(() => {
    if (!open) return;
    setName(sequence?.name ?? '');
    setTrigger(sequence?.trigger ?? 'after_viewing');
    setActive(sequence?.active ?? true);
    setSteps(
      (sequence?.steps ?? [
        { delayDays: 0, channel: 'sms', template: 'გმადლობთ ჩვენებისთვის, {name}! შეკითხვის შემთხვევაში დამიკავშირდით. {agent}' },
        { delayDays: 3, channel: 'sms', template: '{name}, მოვიდა 3 ახალი ვარიანტი თქვენ მოთხოვნით. გაჩვენებთ?' },
      ]).map((s) => ({ ...s, key: newKey() })),
    );
  }, [open, sequence]);

  const patch = (key: string, p: Partial<Step>) => setSteps((s) => s.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const move = (i: number, dir: -1 | 1) =>
    setSteps((s) => {
      const out = [...s];
      const [x] = out.splice(i, 1);
      out.splice(i + dir, 0, x!);
      return out;
    });
  const insertVar = (key: string, v: string) => {
    const el = areas.current[key];
    const step = steps.find((s) => s.key === key)!;
    const pos = el?.selectionStart ?? step.template.length;
    patch(key, { template: `${step.template.slice(0, pos)}{${v}}${step.template.slice(pos)}` });
    setTimeout(() => el?.focus(), 0);
  };

  const save = async () => {
    setBusy(true);
    try {
      const body = { name, trigger, active, steps: steps.map(({ key: _k, ...s }) => ({ ...s, delayDays: Number(s.delayDays) || 0 })) };
      if (sequence) await mutate(`/crm/sequences/${sequence.id}`, { method: 'PATCH', body });
      else await mutate('/crm/sequences', { body });
      toast({ title: t('saved'), tone: 'success' });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const sampleVars = { name: 'ნინო', agent: user.name ?? '', org: workspace?.org.name ?? '' };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={sequence ? t('editor.editTitle') : t('editor.createTitle')}
      description={t('editor.hint')}
      footer={
        <Button onClick={save} loading={busy} disabled={!name.trim() || !steps.length || steps.some((s) => !s.template.trim())}>
          {t('editor.save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 rounded-card border border-border bg-surface-2/60 p-4 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
          <Field label={t('editor.name')} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </Field>
          <Field label={t('trigger.label')}>
            <Select value={trigger} onChange={(e) => setTrigger(e.target.value as typeof trigger)} options={SEQUENCE_TRIGGERS.map((x) => ({ value: x, label: t(`trigger.${x}`) }))} />
          </Field>
          <div className="pb-3">
            <Switch checked={active} onCheckedChange={setActive} label={active ? t('active') : t('inactive')} />
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-[15px] font-semibold">{t('editor.steps')}</h3>
          <div className="mb-1 flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-contrast shadow-sm" aria-hidden>
              <Clock className="size-4" strokeWidth={2.2} />
            </span>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-[13px] font-semibold text-primary-soft-text">{t(`trigger.${trigger}`)}</span>
          </div>
          <ol className="flex flex-col">
            {steps.map((s, i) => {
              const meta = CHANNEL_META[s.channel];
              const Icon = meta.icon;
              return (
                <li key={s.key} className="relative pl-12">
                  <span aria-hidden className="absolute bottom-0 left-[17px] top-0 w-0.5 bg-border" />
                  <div className="relative flex items-center gap-2 py-2.5">
                    <span aria-hidden className="absolute -left-[35px] size-2 rounded-full bg-border-strong ring-4 ring-surface" />
                    <label className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-border-strong bg-surface pl-3 pr-1 text-[13px] text-muted">
                      <span>+</span>
                      <Input type="number" min={0} max={365} value={s.delayDays} onChange={(e) => patch(s.key, { delayDays: Number(e.target.value) })} className="h-6 w-14 rounded-full border-0 bg-surface-2 px-2 text-center text-[13px] font-semibold tabular text-text" aria-label={`${t('editor.delay')} ${i + 1}`} />
                      <span className="pr-2">{t('editor.delay')}</span>
                    </label>
                  </div>
                  <div className="relative mb-1 rounded-card border border-border bg-surface p-3.5 shadow-xs">
                    <span className={cn('absolute -left-[46px] top-3 grid size-9 place-items-center rounded-full bg-tone text-white shadow-sm ring-4 ring-surface', toneClass(meta.tone))} aria-hidden>
                      <Icon className="size-4" strokeWidth={2.2} />
                    </span>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold">{t('editor.step', { n: i + 1 })}</span>
                      <div role="radiogroup" aria-label={t('editor.channel')} className="inline-flex gap-0.5 rounded-full bg-surface-2 p-0.5">
                        {SEQUENCE_CHANNELS.map((c) => {
                          const M = CHANNEL_META[c];
                          const CIcon = M.icon;
                          const on = c === s.channel;
                          return (
                            <button
                              key={c}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              onClick={() => patch(s.key, { channel: c })}
                              className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold transition-all', on ? cn('bg-surface text-tone-ink shadow-sm', toneClass(M.tone)) : 'text-muted hover:text-text')}
                            >
                              <CIcon className="size-3.5" strokeWidth={2} aria-hidden />
                              {t(`channels.${c}`)}
                            </button>
                          );
                        })}
                      </div>
                      <div className="ml-auto flex gap-0.5">
                        <IconButton size="sm" label={t('editor.moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>
                          <ArrowUp className="size-4" strokeWidth={2} />
                        </IconButton>
                        <IconButton size="sm" label={t('editor.moveDown')} disabled={i === steps.length - 1} onClick={() => move(i, 1)}>
                          <ArrowDown className="size-4" strokeWidth={2} />
                        </IconButton>
                        <IconButton size="sm" label={t('editor.removeStep')} disabled={steps.length === 1} onClick={() => setSteps((x) => x.filter((y) => y.key !== s.key))}>
                          <Trash2 className="size-4 text-danger" strokeWidth={2} />
                        </IconButton>
                      </div>
                    </div>
                    <Textarea
                      ref={(el) => {
                        areas.current[s.key] = el;
                      }}
                      aria-label={`${t('editor.template')} ${i + 1}`}
                      value={s.template}
                      onChange={(e) => patch(s.key, { template: e.target.value })}
                      maxLength={1000}
                      className="min-h-20"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
                      <span className="text-muted">{t('editor.variables')}:</span>
                      {(['name', 'agent', 'org'] as const).map((v) => (
                        <button key={v} type="button" onClick={() => insertVar(s.key, v)} className="inline-flex h-7 items-center gap-1 rounded-full bg-primary-soft px-2.5 text-[12.5px] font-medium text-primary-soft-text transition-colors hover:bg-primary-soft/70">
                          <code className="font-semibold">{`{${v}}`}</code> · {t(`editor.vars.${v}`)}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <span className="shrink-0 pt-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">{t('editor.preview')}</span>
                      <p className="rounded-2xl rounded-tl-md bg-surface-2 px-3 py-2 text-[13.5px] leading-5">{renderSequenceTemplate(s.template, sampleVars) || '—'}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="relative pl-12 pt-3">
            <span aria-hidden className="absolute left-[17px] top-0 h-3 w-0.5 bg-border" />
            <button
              type="button"
              onClick={() => setSteps((x) => [...x, { key: newKey(), delayDays: (x.at(-1)?.delayDays ?? 0) + 3, channel: 'sms', template: '' }])}
              className="flex w-full items-center justify-center gap-2 rounded-card border-2 border-dashed border-border-strong py-3 text-[14px] font-semibold text-muted transition-colors hover:border-primary hover:bg-primary-soft/40 hover:text-primary-soft-text"
            >
              <Plus className="size-4" strokeWidth={2.4} aria-hidden />
              {t('editor.addStep')}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
