'use client';
import useSWR from 'swr';
import type { BusinessTypeInput } from '@lokacia/contracts';
import { fetcher } from './api-client';

export type BusinessTypeRow = BusinessTypeInput & { id: string };
export function useBusinessTypes() {
  return useSWR<BusinessTypeRow[]>('/admin/business-types', fetcher);
}
