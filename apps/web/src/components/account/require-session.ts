import 'server-only';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

/** Account pages: logged-in user or redirect to login returning to `path`. */
export async function requireSession(path: string) {
  const user = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  return user;
}
