'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Hand, MapPinned, Repeat2, Shuffle, type LucideIcon } from 'lucide-react';
import { LEAD_DISTRIBUTION_MODES, type LeadDistributionMode } from '@lokacia/contracts';
import { cn, useToast } from '@lokacia/ui';
import { SectionCard, toneClass, type Tone } from '@/components/common/ui';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApiMutation } from '@/lib/swr';

const META: Record<LeadDistributionMode, { icon: LucideIcon; tone: Tone }> = {
  round_robin: { icon: Repeat2, tone: 2 },
  district: { icon: MapPinned, tone: 6 },
  manual: { icon: Hand, tone: 7 },
};

/** Lead distribution mode (C17): round robin / by district / manual. */
export function DistributionSettings({ value, onSaved }: { value: LeadDistributionMode; onSaved?: () => void }) {
  const t = useTranslations('team.distribution');
  const toast = useToast();
  const mutate = useApiMutation();
  const { can, refreshWorkspace } = useCrm();
  const [mode, setMode] = React.useState(value);
  React.useEffect(() => setMode(value), [value]);
  const editable = can('team.manage');
  return (
    <SectionCard id="distribution" icon={Shuffle} tone={6} title={t('title')} description={t('hint')}>
      <div role="radiogroup" aria-label={t('title')} className="grid gap-3 md:grid-cols-3">
        {LEAD_DISTRIBUTION_MODES.map((m) => {
          const on = mode === m;
          const { icon: Icon, tone } = META[m];
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!editable}
              onClick={async () => {
                const prev = mode;
                setMode(m);
                try {
                  await mutate('/crm/team/settings', { method: 'PATCH', body: { leadDistribution: m } });
                  toast({ title: t('saved'), tone: 'success' });
                  await refreshWorkspace();
                  onSaved?.();
                } catch (e) {
                  setMode(prev);
                  toast({ title: errorMessage(e), tone: 'danger' });
                }
              }}
              className={cn(
                'relative flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none disabled:cursor-not-allowed',
                toneClass(tone),
                on ? 'border-tone bg-tone-faint shadow-sm' : 'border-border enabled:hover:-translate-y-0.5 enabled:hover:border-border-strong enabled:hover:shadow-sm',
              )}
            >
              <span className="flex w-full items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-tone-soft text-tone-ink" aria-hidden>
                  <Icon className="size-5" strokeWidth={2} />
                </span>
                <span className={cn('grid size-5 place-items-center rounded-full border-2', on ? 'border-tone' : 'border-border-strong')} aria-hidden>
                  {on && <span className="size-2.5 rounded-full bg-tone" />}
                </span>
              </span>
              <span className="font-semibold">{t(m)}</span>
              <span className="text-[13px] leading-5 text-muted">{t(`${m}Hint`)}</span>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
