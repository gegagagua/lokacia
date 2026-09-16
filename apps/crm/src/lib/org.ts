/** Selected organization is persisted in a (non-httpOnly) cookie so both SSR and the browser send `x-org-id`. */
export const ORG_COOKIE = 'lk_org';

export function readOrgCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)lk_org=([0-9a-f-]{36})/i);
  return m ? m[1]! : null;
}

export function writeOrgCookie(orgId: string) {
  document.cookie = `${ORG_COOKIE}=${orgId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  try {
    localStorage.setItem(ORG_COOKIE, orgId);
  } catch {
    /* private mode */
  }
}
