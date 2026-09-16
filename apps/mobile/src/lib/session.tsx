import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { SessionUser } from '@lokacia/contracts';
import { api, endpoints, sessionExpired } from './api';
import { ApiError } from './api-client';
import { unregisterPush } from './push';

type SessionValue = {
  user: SessionUser | null;
  ready: boolean;
  signIn: (phone: string, code: string, name?: string) => Promise<SessionUser>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Agency orgs → broker mode (add listing on-site). */
  agencyOrgs: SessionUser['orgs'];
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const expiredTick = useSyncExternalStore(sessionExpired.subscribe, sessionExpired.get, sessionExpired.get);

  const refreshUser = useCallback(async () => {
    if (!(await api.hasSession())) {
      setUser(null);
      return;
    }
    try {
      setUser(await endpoints.me());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setUser(null);
      // network errors keep the stored session — the user may be offline on site
    }
  }, []);

  useEffect(() => {
    void refreshUser().finally(() => setReady(true));
  }, [refreshUser]);

  useEffect(() => {
    if (expiredTick > 0) setUser(null);
  }, [expiredTick]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      ready,
      refreshUser,
      agencyOrgs: (user?.orgs ?? []).filter((o) => o.type === 'agency'),
      async signIn(phone, code, name) {
        const u = await api.verifyOtp(phone, code, name);
        setUser(u);
        return u;
      },
      async signOut() {
        await unregisterPush().catch(() => undefined);
        await api.logout();
        setUser(null);
      },
    }),
    [user, ready, refreshUser],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
