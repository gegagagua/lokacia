import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { CrmProvider } from '@/lib/crm-context';
import { getSession, resolveOrg } from '@/lib/session';
import { AppShell } from '@/components/shell/app-shell';
import { NoOrg } from '@/components/shell/no-org';

/** Authenticated CRM workspace: login required, org resolved from cookie (x-org-id on every call). */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) {
    const h = await headers();
    const path = h.get('x-lk-path') ?? '/dashboard';
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  const org = await resolveOrg(user);
  if (!org) return <NoOrg user={user} />;
  return (
    <CrmProvider user={user} orgId={org.id}>
      <AppShell>{children}</AppShell>
    </CrmProvider>
  );
}
