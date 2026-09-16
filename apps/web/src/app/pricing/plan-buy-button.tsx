'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, Info } from 'lucide-react';
import { Button, cn, Select, type ButtonVariant } from '@lokacia/ui';
import { CheckoutButton } from '@/components/billing/checkout-button';

/** Subscription buy button: logged-out → login; org plans need an agency where the user is manager. */
export function PlanBuyButton({ planKey, loggedIn, orgs, label, className, variant = 'primary' }: { planKey: string; loggedIn: boolean; orgs: { id: string; name: string }[] | null; label: string; className?: string; variant?: ButtonVariant }) {
  const t = useTranslations('billing.pricing');
  const [orgId, setOrgId] = React.useState(orgs?.[0]?.id ?? '');
  if (!loggedIn) {
    return (
      <Button asChild variant={variant} size="lg" className={cn('w-full', className)}>
        <Link href="/login?next=/pricing">
          {label}
          <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
        </Link>
      </Button>
    );
  }
  if (orgs && !orgs.length)
    return (
      <p className={cn('flex items-start gap-2 rounded-2xl bg-surface-2 px-3.5 py-3 text-small text-muted', className)}>
        <Info className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
        {t('needAgency')}
      </p>
    );
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {orgs && orgs.length > 1 && <Select aria-label={t('chooseOrg')} value={orgId} onChange={(e) => setOrgId(e.target.value)} options={orgs.map((o) => ({ value: o.id, label: o.name }))} />}
      <CheckoutButton planKey={planKey} variant={variant} size="lg" className="w-full" body={{ orgId: orgs ? orgId : undefined, returnPath: '/account/billing' }} loginNext="/pricing">
        {label}
      </CheckoutButton>
    </div>
  );
}
