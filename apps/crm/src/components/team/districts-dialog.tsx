'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Button, Checkbox, Dialog } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';

export type District = { id: string; slug: string; city: string; nameKa: string };

export function useDistricts() {
  return useSWR('/taxonomy/districts', (p: string) => apiFetch<District[]>(p, { noOrg: true }), { revalidateOnFocus: false });
}

export function DistrictsDialog({ open, onOpenChange, title, value, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; value: string[]; onSave: (ids: string[]) => Promise<void> }) {
  const t = useTranslations('team');
  const common = useTranslations('shell.common');
  const { data: districts = [] } = useDistricts();
  const [selected, setSelected] = React.useState<string[]>(value);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setSelected(value);
  }, [open, value]);
  const cities = [...new Set(districts.map((d) => d.city))];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={t('districtsHint')}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {common('cancel')}
          </Button>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(selected);
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {common('save')}
          </Button>
        </>
      }
    >
      {cities.map((city) => (
        <fieldset key={city} className="mb-4">
          <legend className="mb-2 text-small font-medium text-muted">{districts.find((d) => d.city === city)?.city === 'tbilisi' ? 'თბილისი' : city === 'batumi' ? 'ბათუმი' : city}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {districts
              .filter((d) => d.city === city)
              .map((d) => (
                <Checkbox key={d.id} label={d.nameKa} checked={selected.includes(d.id)} onCheckedChange={(c) => setSelected((s) => (c ? [...s, d.id] : s.filter((x) => x !== d.id)))} />
              ))}
          </div>
        </fieldset>
      ))}
    </Dialog>
  );
}
