'use client';
import * as React from 'react';
import type { ListingCard } from '@lokacia/contracts';
import { Combobox, Select } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';

/** Assign to a team member (agents/managers of the selected org). */
export function MemberSelect({ value, onChange, placeholder = '—', className, includeEmpty = true, id }: { value: string | null | undefined; onChange: (userId: string | null) => void; placeholder?: string; className?: string; includeEmpty?: boolean; id?: string }) {
  const { members } = useCrm();
  return (
    <Select
      id={id}
      className={className}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={includeEmpty ? placeholder : undefined}
      options={members.filter((m) => m.userId && m.active).map((m) => ({ value: m.userId!, label: m.name ?? m.phone ?? '—' }))}
    />
  );
}

/** Contact search combobox (server-side search via the command palette endpoint). */
export function ContactPicker({ value, onChange, placeholder = 'მოძებნეთ კონტაქტი…', initialLabel }: { value: string | null; onChange: (id: string | null, label?: string) => void; placeholder?: string; initialLabel?: string }) {
  const { org } = useCrm();
  const [options, setOptions] = React.useState<{ value: string; label: string; hint?: string }[]>(value && initialLabel ? [{ value, label: initialLabel }] : []);
  const [q, setQ] = React.useState('');
  React.useEffect(() => {
    if (q.trim().length < 2) return;
    const ctl = setTimeout(() => {
      apiFetch<{ contacts: { id: string; name: string; phone: string | null }[] }>(`/crm/search?q=${encodeURIComponent(q.trim())}`, { orgId: org.id })
        .then((r) => setOptions(r.contacts.map((c) => ({ value: c.id, label: c.name, hint: c.phone ?? undefined }))))
        .catch(() => undefined);
    }, 200);
    return () => clearTimeout(ctl);
  }, [q, org.id]);
  return (
    <div onInput={(e) => setQ((e.target as HTMLInputElement).value)}>
      <Combobox options={options} value={value} onChange={(v) => onChange(v, options.find((o) => o.value === v)?.label)} placeholder={placeholder} label={placeholder} />
    </div>
  );
}

/** Listing picker: org listings first, then any active listing on lokacia.ge matching the text. */
export function ListingPicker({ value, onChange, placeholder = 'მოძებნეთ ფართი…', initialLabel }: { value: string | null; onChange: (id: string | null, listing?: ListingCard) => void; placeholder?: string; initialLabel?: string }) {
  const [options, setOptions] = React.useState<ListingCard[]>([]);
  const [q, setQ] = React.useState('');
  React.useEffect(() => {
    const ctl = setTimeout(() => {
      const mine = apiFetch<ListingCard[]>('/listings/mine').catch(() => [] as ListingCard[]);
      const all = q.trim().length >= 2 ? apiFetch<{ items: ListingCard[] }>(`/listings?q=${encodeURIComponent(q.trim())}&limit=20`, { noOrg: true }).then((r) => r.items).catch(() => [] as ListingCard[]) : Promise.resolve([] as ListingCard[]);
      void Promise.all([mine, all]).then(([m, a]) => {
        const term = q.trim().toLowerCase();
        const mf = m.filter((l) => !term || l.title.toLowerCase().includes(term) || l.address.toLowerCase().includes(term)).slice(0, 20);
        const seen = new Set(mf.map((l) => l.id));
        setOptions([...mf, ...a.filter((l) => !seen.has(l.id))]);
      });
    }, 200);
    return () => clearTimeout(ctl);
  }, [q]);
  const opts = options.map((l) => ({ value: l.id, label: l.title, hint: l.address }));
  if (value && initialLabel && !opts.some((o) => o.value === value)) opts.unshift({ value, label: initialLabel, hint: '' });
  return (
    <div onInput={(e) => setQ((e.target as HTMLInputElement).value)}>
      <Combobox options={opts} value={value} onChange={(v) => onChange(v, options.find((o) => o.id === v))} placeholder={placeholder} label={placeholder} />
    </div>
  );
}
