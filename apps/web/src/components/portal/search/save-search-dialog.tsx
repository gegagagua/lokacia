'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BellPlus } from 'lucide-react';
import { ALERT_CHANNELS, type AlertChannel, type SearchFilters } from '@lokacia/contracts';
import { Button, Checkbox, Dialog, Field, Input, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';
import { useLocalizedPath } from '@/i18n/link';
import { useFormat } from '@/i18n/use-format';
import { describeFiltersFor } from './chips';

/** "ძებნის შენახვა" (P7): name + channels → POST /saved-searches. Guests are sent to login. */
export function SaveSearchButton({
  filters,
  loggedIn,
  typeNames,
  districtNames,
  variant = 'secondary',
  size = 'md',
  className,
}: {
  filters: SearchFilters;
  loggedIn: boolean;
  typeNames: Record<string, string>;
  districtNames: Record<string, string>;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const t = useTranslations('search.save');
  const ts = useTranslations('search');
  const fmt = useFormat();
  const lp = useLocalizedPath();
  const router = useRouter();
  const describe = (f: Partial<SearchFilters>, names?: { typeNames: Record<string, string>; districtNames: Record<string, string> }) =>
    describeFiltersFor(f, { ...names, t: (k, v) => ts(k as never, v as never), fmt });
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [channels, setChannels] = React.useState<AlertChannel[]>(['in_app', 'email']);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onOpen = () => {
    if (!loggedIn) {
      router.push(lp(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`));
      return;
    }
    setName(describe(filters, { typeNames, districtNames }).slice(0, 120));
    setError(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channels.length) {
      setError(t('channelsError'));
      return;
    }
    setBusy(true);
    try {
      const { bbox: _bbox, sort: _sort, ...query } = filters;
      await apiFetch('/saved-searches', { method: 'POST', body: { name: name.trim() || describe(query), query, channels } });
      setOpen(false);
      toast({ title: t('saved'), description: t('savedHint'), tone: 'success' });
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 401) router.push(lp(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`));
      else setError(err instanceof ClientApiError ? (err.problem?.detail ?? err.problem?.title ?? t('failed')) : t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={onOpen} icon={<BellPlus className="size-4" strokeWidth={1.5} aria-hidden />} className={className}>
        {t('button')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('title')}
        description={t('description')}
        footer={
          <>
            <Button variant="ghost" asChild>
              <Link href="/account/saved-searches">{t('manage')}</Link>
            </Button>
            <Button type="submit" form="save-search-form" loading={busy}>
              {t('submit')}
            </Button>
          </>
        }
      >
        <form id="save-search-form" onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t('name')} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
          </Field>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2 text-small font-medium">{t('channels')}</legend>
            {ALERT_CHANNELS.map((c) => (
              <Checkbox
                key={c}
                label={ts(`channel.${c}`)}
                checked={channels.includes(c)}
                onCheckedChange={(v) => setChannels((s) => (v ? [...s, c] : s.filter((x) => x !== c)))}
              />
            ))}
          </fieldset>
          {error && (
            <p role="alert" className="text-small text-danger">
              {error}
            </p>
          )}
        </form>
      </Dialog>
    </>
  );
}
