'use client';
import useSWR, { type SWRConfiguration } from 'swr';
import { apiFetch } from './api-client';
import { useCrm } from './crm-context';

/** SWR bound to the selected org: the cache key includes the org id so switching orgs never shows stale data. */
export function useApi<T>(path: string | null, config?: SWRConfiguration<T>) {
  const { org } = useCrm();
  return useSWR<T>(path ? [path, org.id] : null, ([p, orgId]: [string, string]) => apiFetch<T>(p, { orgId }), { revalidateOnFocus: false, ...config });
}

/** Mutation helper bound to the selected org. */
export function useApiMutation() {
  const { org } = useCrm();
  return <T,>(path: string, init: { method?: string; body?: unknown } = {}) => apiFetch<T>(path, { method: init.method ?? 'POST', body: init.body, orgId: org.id });
}
