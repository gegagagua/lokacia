'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Phone } from 'lucide-react';
import { Button } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';

/** Phone hidden until click; each reveal is rate-limited server-side (CLAUDE.md personal data rule). */
export function RevealPhone({ slug }: { slug: string }) {
  const t = useTranslations('profiles.phone');
  const [phone, setPhone] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      {phone ? (
        <Button asChild size="lg">
          <a href={`tel:${phone}`}>
            <Phone className="size-4" strokeWidth={1.5} aria-hidden />
            <span className="tabular">{phone}</span>
          </a>
        </Button>
      ) : (
        <Button
          size="lg"
          loading={busy}
          icon={<Phone className="size-4" strokeWidth={1.5} aria-hidden />}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const r = await apiFetch<{ phone: string | null }>(`/profiles/brokers/${slug}/reveal-phone`, { method: 'POST' });
              if (r.phone) setPhone(r.phone);
              else setError(t('error'));
            } catch (e) {
              setError(e instanceof ClientApiError && e.status === 429 ? t('limited') : t('error'));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('reveal')}
        </Button>
      )}
      <p aria-live="polite" className="text-small text-danger">
        {error}
      </p>
    </div>
  );
}
