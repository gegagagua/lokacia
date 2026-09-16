import type { Metadata } from 'next';
import { ContactDetailView } from '@/components/contacts/contact-detail';

export const metadata: Metadata = { title: 'კონტაქტი' };

export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <ContactDetailView id={id} initialTab={tab} />;
}
