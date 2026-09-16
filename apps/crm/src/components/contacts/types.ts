import type { ContactRow, ListingCard, MatchStatus } from '@lokacia/contracts';
import type { ContactRequirements } from '@/lib/types';

export type ContactDetail = ContactRow & {
  requirements: ContactRequirements | null;
  notes: string | null;
  portalToken: string | null;
  deals: { id: string; title: string; stage: string; valueMinor: number; agentId: string | null; updatedAt: string }[];
  tasks: { id: string; title: string; dueAt: string | null; doneAt: string | null; priority: 'low' | 'normal' | 'high' }[];
  viewings: { id: string; title: string; startsAt: string; status: 'planned' | 'done' | 'cancelled'; address: string | null }[];
  matches: Partial<Record<MatchStatus, number>>;
};

export type ContactMatch = { id: string; score: number; status: MatchStatus; clientComment: string | null; createdAt: string; updatedAt: string; listing: ListingCard };

export type ContactFacets = { tags: { tag: string; count: number }[]; sources: { key: string; name: string }[] };

export type District = { id: string; slug: string; nameKa: string; city: string };
