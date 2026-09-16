import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@lokacia/ui';
import { getSession } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'შესვლა', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/dashboard';
  if (await getSession()) redirect(safeNext);
  return (
    <main id="main" className="drawing-grid flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <Logo />
      <LoginForm next={safeNext} />
    </main>
  );
}
