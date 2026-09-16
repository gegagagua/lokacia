'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { CircleCheck, CircleX } from 'lucide-react';
import { formatDateKa } from '@lokacia/contracts';
import { Button, Card, Checkbox, EmptyState, Field, Input, Logo, Skeleton, useToast } from '@lokacia/ui';
import { apiFetch, errorMessage } from '@/lib/api-client';

type SignDoc = { title: string; version: number; org: { name: string; logoUrl: string | null; brandColor: string | null }; text: string; signStatus: 'draft' | 'sent' | 'signed' | 'declined'; signedAt: string | null; signerName: string | null };

/** Public e-sign page (MockESign adapter link: CRM_URL/sign/:ref). */
export function SignView({ signRef }: { signRef: string }) {
  const t = useTranslations('documents.sign');
  const toast = useToast();
  const { data, error, mutate } = useSWR(`/crm/documents/sign/${signRef}`, (p: string) => apiFetch<SignDoc>(p, { noOrg: true }));
  const [agree, setAgree] = React.useState(false);
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState<'sign' | 'decline' | null>(null);
  const decide = async (decision: 'sign' | 'decline') => {
    setBusy(decision);
    try {
      await apiFetch(`/crm/documents/sign/${signRef}`, { method: 'POST', body: { decision, name }, noOrg: true });
      await mutate();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };
  if (error) return <div className="container-page py-16"><EmptyState title={t('notFound')} /></div>;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8">
      <header className="flex items-center justify-between border-b-2 pb-3" style={{ borderColor: data?.org.brandColor ?? 'var(--primary)' }}>
        <div className="flex items-center gap-3">
          {data?.org.logoUrl && <img src={data.org.logoUrl} alt="" className="size-10 rounded-[6px] border border-border object-cover" />}
          <span className="compact text-h3 font-semibold">{data?.org.name}</span>
        </div>
        <Logo size={20} showGeorgian={false} />
      </header>
      {!data ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div>
            <h1 className="compact text-h2 font-semibold">{data.title}</h1>
            <p className="text-small text-muted">v{data.version} · {t('demo')}</p>
          </div>
          <Card className="whitespace-pre-wrap p-5 text-[15px] leading-relaxed">{data.text}</Card>
          {data.signStatus === 'signed' && (
            <Card className="flex items-center gap-3 border-success p-4">
              <CircleCheck className="size-6 text-success" strokeWidth={1.5} aria-hidden />
              <div>
                <div className="font-medium">{t('signed')}</div>
                <div className="text-small text-muted tabular">{data.signerName}{data.signedAt ? ` · ${formatDateKa(data.signedAt)}` : ''}</div>
              </div>
            </Card>
          )}
          {data.signStatus === 'declined' && (
            <Card className="flex items-center gap-3 border-danger p-4">
              <CircleX className="size-6 text-danger" strokeWidth={1.5} aria-hidden />
              <div className="font-medium">{t('declined')}</div>
            </Card>
          )}
          {data.signStatus === 'draft' && <p className="text-muted">{t('notAvailable')}</p>}
          {data.signStatus === 'sent' && (
            <Card className="flex flex-col gap-4 p-5">
              <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} label={t('readConfirm')} />
              <Field label={t('name')}>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="danger" onClick={() => decide('decline')} loading={busy === 'decline'} disabled={name.trim().length < 2}>
                  {t('decline')}
                </Button>
                <Button onClick={() => decide('sign')} loading={busy === 'sign'} disabled={!agree || name.trim().length < 2}>
                  {t('sign')}
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
