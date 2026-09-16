'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Copy, ExternalLink, Rss } from 'lucide-react';
import { Button, useToast } from '@lokacia/ui';
import { IconTile } from '@/components/common/ui';
import { useCrm } from '@/lib/crm-context';

/** C9: copyable XML feed URL for other portals (public endpoint, served by the API through the same-origin rewrite). */
export function FeedBox() {
  const t = useTranslations('listings.feed');
  const toast = useToast();
  const { org } = useCrm();
  const [url, setUrl] = React.useState(`/api/v1/feeds/${org.id}.xml`);
  React.useEffect(() => setUrl(`${window.location.origin}/api/v1/feeds/${org.id}.xml`), [org.id]);
  return (
    <section className="card flex flex-col gap-4 p-4 md:flex-row md:items-center md:p-5" aria-labelledby="lk-feed-title">
      <div className="flex min-w-0 items-start gap-3 md:max-w-sm md:shrink-0">
        <IconTile icon={Rss} tone={7} />
        <div className="min-w-0">
          <h2 id="lk-feed-title" className="text-[15.5px] font-semibold leading-6">
            {t('title')}
          </h2>
          <p className="text-[13.5px] leading-5 text-muted">{t('hint')}</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border bg-surface-2 p-1.5 pl-3.5">
        <input readOnly value={url} aria-label={t('title')} className="min-w-0 flex-1 truncate bg-transparent font-mono text-[13px] text-muted outline-none" onFocus={(e) => e.currentTarget.select()} />
        <Button
          variant="secondary"
          size="sm"
          icon={<Copy className="size-4" strokeWidth={2} aria-hidden />}
          aria-label={t('copy')}
          onClick={async () => {
            await navigator.clipboard.writeText(url).catch(() => undefined);
            toast({ title: t('copied'), tone: 'success' });
          }}
        >
          <span className="hidden sm:inline">{t('copy')}</span>
        </Button>
        <Button asChild variant="ghost" size="sm" className="px-2.5">
          <a href={url} target="_blank" rel="noreferrer" aria-label={t('open')} title={t('open')}>
            <ExternalLink className="size-4" strokeWidth={2} aria-hidden />
          </a>
        </Button>
      </div>
    </section>
  );
}
