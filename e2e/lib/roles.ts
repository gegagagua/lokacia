import path from 'node:path';
import { AUTH_DIR } from './env';

/** Demo accounts seeded by `pnpm db:seed` (skill lokacia-run-and-verify). */
export const ROLES = {
  owner: '+995500000003',
  tenant: '+995500000006',
  agencyManager: '+995500000004',
  moderator: '+995500000002',
  admin: '+995500000001',
} as const;

/** Extra demo accounts used only for UI login flows (keeps OTP rate-limit buckets of the stored roles free). */
export const UI_LOGIN_PHONES = { agent: '+995500000005', developer: '+995500000007' } as const;

export type Role = keyof typeof ROLES;

export const storageStateFor = (role: Role) => path.join(AUTH_DIR, `${role}.json`);
