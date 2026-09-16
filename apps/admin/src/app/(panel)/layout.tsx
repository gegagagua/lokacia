import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { ShieldOff } from 'lucide-react';
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
      <main className="drawing-grid flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
        <Logo size={30} showGeorgian={false} />
        <Card className="w-full max-w-md p-8 text-center shadow-lg" role="alert">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger/10 text-danger">
            <ShieldOff className="size-6" strokeWidth={2} aria-hidden />
          </span>
          <h1 className="mt-5 text-[26px] font-bold tracking-tight">{t('forbiddenTitle')}</h1>
          <p className="mt-2 text-muted">{t('forbiddenText')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
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
