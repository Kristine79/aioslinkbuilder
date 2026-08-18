import type { OpportunityDraft, PlacementOpportunity } from '@aios/domain';
import type { PlacementOpportunityRepository } from '@aios/application';

import { randomUUID } from 'node:crypto';

/**
 * In-memory implementation of PlacementOpportunityRepository. Used by the
 * prototype demo, the API composition and tests; the Prisma repositories
 * remain the production path.
 */
export class InMemoryPlacementOpportunityRepository implements PlacementOpportunityRepository {
  readonly opportunities = new Map<string, PlacementOpportunity>();

  findById(id: string): Promise<PlacementOpportunity | null> {
    return Promise.resolve(this.opportunities.get(id) ?? null);
  }

  findByCampaignId(campaignId: string): Promise<PlacementOpportunity[]> {
    return Promise.resolve(
      [...this.opportunities.values()].filter(
        (opportunity) => opportunity.campaignId === campaignId,
      ),
    );
  }

  findByCampaignIdAndPlatformId(
    campaignId: string,
    platformId: string,
  ): Promise<PlacementOpportunity | null> {
    const match = [...this.opportunities.values()].find(
      (opportunity) =>
        opportunity.campaignId === campaignId && opportunity.platformId === platformId,
    );
    return Promise.resolve(match ?? null);
  }

  create(draft: OpportunityDraft): Promise<PlacementOpportunity> {
    const now = new Date();
    const opportunity: PlacementOpportunity = {
      id: randomUUID(),
      campaignId: draft.campaignId,
      platformId: draft.platformId,
      categoryId: draft.categoryId ?? null,
      placementType: draft.placementType,
      relevance: null,
      score: null,
      scoreBreakdown: null,
      recommendation: null,
      whyRecommended: null,
      placementMethod: draft.placementMethod,
      providerCapabilities: [],
      status: 'DISCOVERED',
      metadata: draft.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.opportunities.set(opportunity.id, opportunity);
    return Promise.resolve(opportunity);
  }

  update(opportunity: PlacementOpportunity): Promise<PlacementOpportunity> {
    this.opportunities.set(opportunity.id, opportunity);
    return Promise.resolve(opportunity);
  }
}
