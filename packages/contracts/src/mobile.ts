import { z } from 'zod';
import type { SessionUser } from './domain';

/* ---------------- mobile apps (V7) ---------------- */

/** Header that switches auth endpoints to token mode (tokens in JSON body, no cookies). */
export const MOBILE_CLIENT_HEADER = 'x-client';
export const MOBILE_CLIENT_VALUE = 'mobile';

export type MobileTokens = { accessToken: string; refreshToken: string; expiresIn: number };
export type MobileVerifyResponse = MobileTokens & { user: SessionUser };
export type MobileRefreshResponse = MobileTokens & { ok: true };

export const mobileRefreshSchema = z.object({ refreshToken: z.string().min(10).max(512) });

/** Expo push token, e.g. `ExponentPushToken[xxxxxxxx]`. */
export const EXPO_PUSH_TOKEN_RE = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$/;
export const MAX_PUSH_TOKENS = 10;

export const pushTokenSchema = z.object({
  token: z.string().regex(EXPO_PUSH_TOKEN_RE, 'push ტოკენი არასწორია'),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});
export type PushTokenInput = z.infer<typeof pushTokenSchema>;

/** Adds a token (most recent last), dedupes and keeps the newest MAX_PUSH_TOKENS devices. */
export function addPushToken(existing: readonly string[] | undefined, token: string): string[] {
  const next = [...(existing ?? []).filter((t) => t !== token), token];
  return next.slice(-MAX_PUSH_TOKENS);
}
