'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { useTranslations } from 'next-intl';
import { Button, Select } from '@lokacia/ui';
import { CheckoutButton } from '@/components/billing/checkout-button';

/** Subscription buy button: logged-out → login; org plans need an agency where the user is manager. */
export function PlanBuyButton({ planKey, loggedIn, orgs, label, className }: { planKey: string; loggedIn: boolean; orgs: { id: string; name: string }[] | null; label: string; className?: string }) {
  const t = useTranslations('billing.pricing');
  const [orgId, setOrgId] = React.useState(orgs?.[0]?.id ?? '');
  if (!loggedIn) {
    return (
      <Button asChild className={className}>
        <Link href="/login?next=/pricing">{label}</Link>
      </Button>
    );
  }
  if (orgs && !orgs.length) return <p className={`${className ?? ''} text-small text-muted`}>{t('needAgency')}</p>;
  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      {orgs && orgs.length > 1 && <Select aria-label={t('chooseOrg')} value={orgId} onChange={(e) => setOrgId(e.target.value)} options={orgs.map((o) => ({ value: o.id, label: o.name }))} />}
      <CheckoutButton planKey={planKey} body={{ orgId: orgs ? orgId : undefined, returnPath: '/account/billing' }} loginNext="/pricing">
        {label}
      </CheckoutButton>
    </div>
  );
}
