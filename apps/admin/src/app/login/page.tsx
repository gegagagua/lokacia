import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@lokacia/ui';
import { getSession } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'შესვლა' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const session = await getSession();
  if (session && (session.role === 'admin' || session.role === 'moderator')) redirect(safeNext);
  return (
    <main className="drawing-grid flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-12">
      <Logo size={30} />
      <LoginForm next={safeNext} />
    </main>
  );
}
