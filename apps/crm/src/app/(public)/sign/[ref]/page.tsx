import type { Metadata } from 'next';
import { SignView } from './sign-view';

export const metadata: Metadata = { title: 'დოკუმენტის ხელმოწერა', robots: { index: false, follow: false } };

export default async function SignPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return <SignView signRef={ref} />;
}
