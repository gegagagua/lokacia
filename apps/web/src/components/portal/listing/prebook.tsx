'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Building, CheckCircle2 } from 'lucide-react';
import { formatDateKa } from '@lokacia/contracts';
import { Button, Dialog, Field, Input, Textarea } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';

/** P8: off-plan project block with pre-booking request. */
export function ProjectBlock({ listingId, project }: { listingId: string; project: { name: string; slug: string; completionDate: string } }) {
  const t = useTranslations('listing.project');
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [state, setState] = React.useState<{ loading?: boolean; done?: 'ok' | 'duplicate'; error?: string }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ loading: true });
    try {
      const r = await apiFetch<{ duplicate: boolean }>(`/listings/${listingId}/prebook`, { method: 'POST', body: { message: message || null, phone: phone || null } });
      setState({ done: r.duplicate ? 'duplicate' : 'ok' });
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 401) {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setState({ error: err instanceof ClientApiError ? (err.problem?.detail ?? err.problem?.title ?? t('error')) : t('error') });
    }
  }

  return (
    <section aria-labelledby="project-title" className="flex flex-col gap-3 rounded-card border border-primary/40 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Building className="mt-1 size-6 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
        <div>
          <h2 id="project-title" className="text-small font-medium uppercase tracking-wide text-muted">
            {t('title')}
          </h2>
          <Link href={`/projects/${project.slug}`} className="text-h3 font-semibold hover:text-link hover:underline">
            {project.name}
          </Link>
          <p className="text-small text-muted tabular">{t('completion', { date: formatDateKa(project.completionDate) })}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link href={`/projects/${project.slug}`}>{t('open')}</Link>
        </Button>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setState({});
          }}
          title={t('dialogTitle')}
          description={t('dialogText')}
          trigger={<Button>{t('prebook')}</Button>}
        >
          {state.done ? (
            <p role="status" className="flex items-start gap-2 text-[15px]">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" strokeWidth={1.5} aria-hidden />
              {state.done === 'ok' ? t('success') : t('duplicate')}
            </p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field label={t('message')}>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} placeholder={t('messagePlaceholder')} />
              </Field>
              <Field label={t('phone')}>
                <Input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="+995 5__ __ __ __" />
              </Field>
              {state.error && (
                <p role="alert" className="text-small text-danger">
                  {state.error}
                </p>
              )}
              <Button type="submit" loading={state.loading}>
                {t('submit')}
              </Button>
            </form>
          )}
        </Dialog>
      </div>
    </section>
  );
}
