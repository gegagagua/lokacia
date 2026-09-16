import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'შესვლა', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
  if (await getSession()) redirect(safeNext);
  return (
    <div className="drawing-grid min-h-[70dvh] py-12">
      <div className="container-page flex justify-center">
        <LoginForm next={safeNext} />
      </div>
    </div>
  );
}
