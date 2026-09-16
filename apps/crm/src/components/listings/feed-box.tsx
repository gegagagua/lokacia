'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Copy, ExternalLink, Rss } from 'lucide-react';
import { Button, Input, useToast } from '@lokacia/ui';
import { useCrm } from '@/lib/crm-context';

/** C9: copyable XML feed URL for other portals (public endpoint, served by the API through the same-origin rewrite). */
export function FeedBox() {
  const t = useTranslations('listings.feed');
  const toast = useToast();
  const { org } = useCrm();
  const [url, setUrl] = React.useState(`/api/v1/feeds/${org.id}.xml`);
  React.useEffect(() => setUrl(`${window.location.origin}/api/v1/feeds/${org.id}.xml`), [org.id]);
  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 md:flex-row md:items-center">
      <div className="flex min-w-0 items-start gap-3 md:w-72 md:shrink-0">
        <Rss className="mt-0.5 size-4 shrink-0 text-link" strokeWidth={1.5} aria-hidden />
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">{t('title')}</h2>
          <p className="text-small text-muted">{t('hint')}</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 gap-2">
        <Input readOnly value={url} aria-label={t('title')} className="min-w-0 flex-1 font-mono text-small" onFocus={(e) => e.currentTarget.select()} />
        <Button
          variant="secondary"
          size="sm"
          className="h-10"
          icon={<Copy className="size-3.5" strokeWidth={1.5} aria-hidden />}
          onClick={async () => {
            await navigator.clipboard.writeText(url).catch(() => undefined);
            toast({ title: t('copied'), tone: 'success' });
          }}
        >
          <span className="hidden sm:inline">{t('copy')}</span>
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-10">
          <a href={url} target="_blank" rel="noreferrer" aria-label={t('open')}>
            <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
          </a>
        </Button>
      </div>
    </section>
  );
}
