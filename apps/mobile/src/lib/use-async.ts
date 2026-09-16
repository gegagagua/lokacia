import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> = { data: T | undefined; error: unknown; loading: boolean; refreshing: boolean; reload: (opts?: { silent?: boolean }) => Promise<void>; setData: (fn: (prev: T | undefined) => T | undefined) => void };

/** Minimal data hook: load on mount / when deps change, pull-to-refresh, optional polling. */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[], opts: { enabled?: boolean; pollMs?: number } = {}): AsyncState<T> {
  const enabled = opts.enabled ?? true;
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    const id = ++seq.current;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = await fnRef.current();
      if (id === seq.current) {
        setDataState(result);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current && mode !== 'silent') setError(e);
    } finally {
      if (id === seq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void run('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  useEffect(() => {
    if (!enabled || !opts.pollMs) return;
    const h = setInterval(() => void run('silent'), opts.pollMs);
    return () => clearInterval(h);
  }, [enabled, opts.pollMs, run]);

  return {
    data,
    error,
    loading,
    refreshing,
    reload: (o) => run(o?.silent ? 'silent' : 'refresh'),
    setData: (updater) => setDataState((prev) => updater(prev)),
  };
}
