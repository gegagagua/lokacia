/** UI-side types mirrored from the DB schema (the CRM app does not import @lokacia/db). */
export type PipelineStage = { key: string; name: string; kind: 'open' | 'won' | 'lost' };
export type ContactRequirements = {
  businessType?: string;
  dealType?: 'rent' | 'sale' | 'transfer' | 'short_term';
  areaMin?: number;
  areaMax?: number;
  budgetMaxMinor?: number;
  districtIds?: string[];
  notes?: string;
};
