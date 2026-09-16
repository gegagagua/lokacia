import type { DealCard, ListingCard } from '@lokacia/contracts';
import type { PipelineStage } from '@/lib/types';

export type Board = { pipeline: { id: string; name: string; stages: PipelineStage[] }; financeVisible: boolean; deals: DealCard[] };

export type DealDetail = DealCard & {
  pipeline: { id: string; name: string; stages: PipelineStage[] };
  contact: { id: string; name: string; company: string | null; phones: string[]; emails: string[]; type: string } | null;
  listing: ListingCard | null;
  finance: { valueMinor: number; commissionPct: number; agentSharePct: number; commissionMinor: number; agentMinor: number; agencyMinor: number; probabilityPct: number; expectedMinor: number } | null;
  stageHistory: { from: string | null; to: string; lostReason: string | null; at: string; by: string | null }[];
};

export const toGel = (minor: number | null | undefined) => (minor == null ? '' : String(Math.round(minor) / 100));
export const toMinor = (gel: string) => Math.round(Number(gel.replace(',', '.').replace(/\s/g, '') || 0) * 100);
