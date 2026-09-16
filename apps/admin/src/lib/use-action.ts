'use client';
import * as React from 'react';
import { useToast } from '@lokacia/ui';
import { ClientApiError } from './api-client';

export function problemMessage(e: unknown): string {
  if (e instanceof ClientApiError) {
    const p = e.problem;
    if (p?.errors?.length) return `${p.title}: ${p.errors.map((x) => `${x.path} — ${x.message}`).join('; ')}`;
    return p?.detail ? `${p.title}: ${p.detail}` : (p?.title ?? e.message);
  }
  return e instanceof Error ? e.message : String(e);
}

/** Runs a mutation, shows a toast on success/failure, tracks busy state. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const run = React.useCallback(
    async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const r = await fn();
        if (success) toast({ title: success, tone: 'success' });
        return r;
      } catch (e) {
        toast({ title: problemMessage(e), tone: 'danger' });
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { run, busy };
}
