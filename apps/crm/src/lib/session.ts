import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import type { SessionUser } from '@lokacia/contracts';
import { apiOrNull } from './api-server';
import { ORG_COOKIE } from './org';

/** Current user for this request (deduped per render). */
export const getSession = cache(async () => apiOrNull<SessionUser>('/v1/auth/me'));

/** Selected organization: cookie if the user is still a member, else the first agency membership. */
export async function resolveOrg(user: SessionUser) {
  const wanted = (await cookies()).get(ORG_COOKIE)?.value;
  return user.orgs.find((o) => o.id === wanted) ?? user.orgs.find((o) => o.type === 'agency') ?? user.orgs[0] ?? null;
}
