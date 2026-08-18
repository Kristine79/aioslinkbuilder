import type { OpportunityDraft, PlacementOpportunity } from '@aios/domain';

export interface PlacementOpportunityRepository {
  findById(id: string): Promise<PlacementOpportunity | null>;
  findByCampaignId(campaignId: string): Promise<PlacementOpportunity[]>;
  findByCampaignIdAndPlatformId(
    campaignId: string,
    platformId: string,
  ): Promise<PlacementOpportunity | null>;
  create(draft: OpportunityDraft): Promise<PlacementOpportunity>;
  update(opportunity: PlacementOpportunity): Promise<PlacementOpportunity>;
}
