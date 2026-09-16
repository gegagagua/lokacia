import { getTranslations } from 'next-intl/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ClipboardCheck } from 'lucide-react';
import { getPermits } from '../data';

/** P12: permits checklist for the listing's business type (markdown managed in admin). */
export async function PermitsChecklist({ businessType, typeName }: { businessType: string; typeName: string }) {
  const page = await getPermits(businessType);
  if (!page) return null;
  const t = await getTranslations('listing.permits');
  return (
    <details className="group rounded-card border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-card p-5 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-link" strokeWidth={1.5} aria-hidden />
          <span>
            <span className="block text-h3 font-semibold">{t('title')}</span>
            <span className="block text-small text-muted">{t('subtitle', { type: typeName })}</span>
          </span>
        </span>
        <span aria-hidden className="text-h3 text-muted transition-transform duration-150 group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="prose-ka border-t border-border px-5 py-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{page.bodyMd}</ReactMarkdown>
      </div>
    </details>
  );
}
