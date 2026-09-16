import 'server-only';
import { cache } from 'react';
import { api } from './api-server';

export type BusinessTypeDto = { id: string; slug: string; nameKa: string; nameEn: string; nameRu: string; icon: string; utilityCoef: number; fitoutPerM2Minor: number; filterConfig: { filters: { key: string; kind: 'boolean' | 'min'; labelKa: string; unit?: string; min?: number; max?: number; step?: number }[]; required: string[] } };
export type DistrictDto = { id: string; slug: string; city: string; nameKa: string; nameEn: string; nameRu: string; centerLat: number; centerLng: number; avgPriceM2Minor: number; activeCount: number; vacancyCount: number };

export const getBusinessTypes = cache(() => api<BusinessTypeDto[]>('/v1/taxonomy/business-types', { auth: false, revalidate: 300 }));
export const getDistricts = cache((city?: string) => api<DistrictDto[]>(`/v1/taxonomy/districts${city ? `?city=${city}` : ''}`, { auth: false, revalidate: 300 }));
