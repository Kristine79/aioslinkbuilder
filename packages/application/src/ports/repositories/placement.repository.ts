import type { Placement, PlacementDraft } from '@aios/domain';

export interface PlacementRepository {
  findById(id: string): Promise<Placement | null>;
  findByOpportunityId(opportunityId: string): Promise<Placement[]>;
  create(draft: PlacementDraft): Promise<Placement>;
  save(placement: Placement): Promise<Placement>;
}
