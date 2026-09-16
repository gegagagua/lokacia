import type { Metadata } from 'next';
import { ContactsList } from '@/components/contacts/contacts-list';

export const metadata: Metadata = { title: 'კონტაქტები' };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <ContactsList openNew={sp.new === '1'} initial={{ q: sp.q ?? '', type: sp.type ?? '', tag: sp.tag ?? '', source: sp.source ?? '', agentId: sp.agentId ?? '', hasRequirements: sp.hasRequirements === 'true' }} />;
}
