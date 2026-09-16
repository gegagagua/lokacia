'use client';
import * as React from 'react';
import type { SessionUser } from '@lokacia/contracts';

const Ctx = React.createContext<SessionUser | null>(null);
export const SessionProvider = ({ user, children }: { user: SessionUser; children: React.ReactNode }) => <Ctx.Provider value={user}>{children}</Ctx.Provider>;
export function useSessionUser() {
  return React.useContext(Ctx);
}
export function useIsAdmin() {
  return useSessionUser()?.role === 'admin';
}
