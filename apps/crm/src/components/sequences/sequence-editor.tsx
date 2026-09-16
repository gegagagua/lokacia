'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { renderSequenceTemplate, SEQUENCE_CHANNELS, SEQUENCE_TRIGGERS, type CrmSequence, type SequenceInput } from '@lokacia/contracts';
import { Button, Dialog, Field, IconButton, Input, Select, Switch, Textarea, useToast } from '@lokacia/ui';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApiMutation } from '@/lib/swr';

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
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
          <Field label={t('editor.name')} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </Field>
          <Field label={t('trigger.label')}>
            <Select value={trigger} onChange={(e) => setTrigger(e.target.value as typeof trigger)} options={SEQUENCE_TRIGGERS.map((x) => ({ value: x, label: t(`trigger.${x}`) }))} />
          </Field>
          <div className="pb-2">
            <Switch checked={active} onCheckedChange={setActive} label={active ? t('active') : t('inactive')} />
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-small font-medium">{t('editor.steps')}</h3>
          <ol className="flex flex-col gap-3">
            {steps.map((s, i) => (
              <li key={s.key} className="rounded-card border border-border bg-bg p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-primary text-[12px] font-semibold text-primary-contrast tabular">{i + 1}</span>
                  <label className="flex items-center gap-2 text-small">
                    <span className="text-muted">{t('editor.delay')}</span>
                    <Input type="number" min={0} max={365} value={s.delayDays} onChange={(e) => patch(s.key, { delayDays: Number(e.target.value) })} className="h-8 w-20 tabular" />
                  </label>
                  <Select aria-label={t('editor.channel')} value={s.channel} onChange={(e) => patch(s.key, { channel: e.target.value as Step['channel'] })} options={SEQUENCE_CHANNELS.map((c) => ({ value: c, label: t(`channels.${c}`) }))} className="h-8 w-36" />
                  <div className="ml-auto flex gap-1">
                    <IconButton size="sm" label={t('editor.moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="size-4" strokeWidth={1.5} />
                    </IconButton>
                    <IconButton size="sm" label={t('editor.moveDown')} disabled={i === steps.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="size-4" strokeWidth={1.5} />
                    </IconButton>
                    <IconButton size="sm" label={t('editor.removeStep')} disabled={steps.length === 1} onClick={() => setSteps((x) => x.filter((y) => y.key !== s.key))}>
                      <Trash2 className="size-4 text-danger" strokeWidth={1.5} />
                    </IconButton>
                  </div>
                </div>
                <Textarea ref={(el) => { areas.current[s.key] = el; }} aria-label={`${t('editor.template')} ${i + 1}`} value={s.template} onChange={(e) => patch(s.key, { template: e.target.value })} maxLength={1000} className="min-h-20" />
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-small">
                  <span className="text-muted">{t('editor.variables')}:</span>
                  {(['name', 'agent', 'org'] as const).map((v) => (
                    <button key={v} type="button" onClick={() => insertVar(s.key, v)} className="rounded-[4px] border border-border-strong px-1.5 py-0.5 text-[12px] hover:bg-surface-2">
                      {`{${v}}`} · {t(`editor.vars.${v}`)}
                    </button>
                  ))}
                </div>
                <p className="mt-2 border-l-2 border-link pl-2 text-small text-muted">
                  {t('editor.preview')}: {renderSequenceTemplate(s.template, sampleVars)}
                </p>
              </li>
            ))}
          </ol>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            icon={<Plus className="size-4" strokeWidth={1.5} aria-hidden />}
            onClick={() => setSteps((x) => [...x, { key: newKey(), delayDays: (x.at(-1)?.delayDays ?? 0) + 3, channel: 'sms', template: '' }])}
          >
            {t('editor.addStep')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
