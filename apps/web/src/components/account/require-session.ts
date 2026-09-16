import 'server-only';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getAppLocale } from '@/i18n/server';
import { localizePath } from '@/i18n/locale';

/** Account pages: logged-in user or redirect to login returning to `path`. */
export async function requireSession(path: string) {
  const user = await getSession();
  if (!user) redirect(localizePath(`/login?next=${encodeURIComponent(path)}`, await getAppLocale()));
  return user;
}
