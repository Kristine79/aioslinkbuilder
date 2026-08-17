import type { Placement } from '@aios/domain';

export interface PlacementRepository {
  findById(id: string): Promise<Placement | null>;
  findByOpportunityId(opportunityId: string): Promise<Placement[]>;
  save(placement: Placement): Promise<Placement>;
}
