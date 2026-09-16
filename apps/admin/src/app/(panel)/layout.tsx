import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Button, Card, Logo } from '@lokacia/ui';
import { getSession } from '@/lib/session';
import { SessionProvider } from '@/lib/session-context';
import { AdminShell } from '@/components/shell/admin-shell';
import { LogoutButton } from '@/components/shell/logout-button';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) {
    const h = await headers();
    const path = h.get('x-pathname') ?? '/';
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (user.role !== 'admin' && user.role !== 'moderator') {
    const t = await getTranslations('auth');
    const portal = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';
    return (
      <main className="drawing-grid flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
        <Logo size={30} />
        <Card className="w-full max-w-md p-6 text-center" role="alert">
          <h1 className="text-h2 font-semibold">{t('forbiddenTitle')}</h1>
          <p className="mt-2 text-muted">{t('forbiddenText')}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild variant="secondary">
              <a href={portal}>{t('toPortal')}</a>
            </Button>
            <LogoutButton />
          </div>
        </Card>
      </main>
    );
  }
  return (
    <SessionProvider user={user}>
      <AdminShell user={user}>{children}</AdminShell>
    </SessionProvider>
  );
}
