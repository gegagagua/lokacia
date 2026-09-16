'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { LEAD_DISTRIBUTION_MODES, type LeadDistributionMode } from '@lokacia/contracts';
import { Card, cn, useToast } from '@lokacia/ui';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApiMutation } from '@/lib/swr';

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
    <Card className="p-4" id="distribution">
      <h2 className="font-semibold">{t('title')}</h2>
      <p className="mb-3 text-small text-muted">{t('hint')}</p>
      <div role="radiogroup" aria-label={t('title')} className="grid gap-2 md:grid-cols-3">
        {LEAD_DISTRIBUTION_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
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
            className={cn('flex flex-col items-start gap-1 rounded-card border p-3 text-left disabled:cursor-not-allowed', mode === m ? 'border-primary bg-primary/5' : 'border-border hover:border-border-strong')}
          >
            <span className="flex items-center gap-2 font-medium">
              <span className={cn('grid size-4 place-items-center rounded-full border', mode === m ? 'border-primary' : 'border-border-strong')}>{mode === m && <span className="size-2 rounded-full bg-primary" />}</span>
              {t(m)}
            </span>
            <span className="text-small text-muted">{t(`${m}Hint`)}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
