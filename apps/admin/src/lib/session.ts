import 'server-only';
import { cache } from 'react';
import type { SessionUser } from '@lokacia/contracts';
import { apiOrNull } from './api-server';

/** Current user for this request (deduped per render). */
export const getSession = cache(async () => apiOrNull<SessionUser>('/v1/auth/me'));
