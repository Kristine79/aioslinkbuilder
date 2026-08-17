import type { PlacementOpportunity } from '@aios/domain';

export interface PlacementOpportunityRepository {
  findById(id: string): Promise<PlacementOpportunity | null>;
  findByCampaignId(campaignId: string): Promise<PlacementOpportunity[]>;
  save(opportunity: PlacementOpportunity): Promise<PlacementOpportunity>;
}