import type { Campaign, CampaignDraft } from '@aios/domain';
import type { CampaignRepository } from '@aios/application';

import { randomUUID } from 'node:crypto';

/**
 * In-memory implementation of CampaignRepository. Used by the prototype
 * demo, the API composition and tests; the Prisma repositories remain the
 * production path.
 */
export class InMemoryCampaignRepository implements CampaignRepository {
  readonly campaigns = new Map<string, Campaign>();

  findById(id: string): Promise<Campaign | null> {
    return Promise.resolve(this.campaigns.get(id) ?? null);
  }

  findByCompanyId(companyId: string): Promise<Campaign[]> {
    return Promise.resolve(
      [...this.campaigns.values()].filter((campaign) => campaign.companyId === companyId),
    );
  }

  create(draft: CampaignDraft): Promise<Campaign> {
    const now = new Date();
    const campaign: Campaign = {
      id: randomUUID(),
      companyId: draft.companyId,
      name: draft.name,
      goals: draft.goals,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    };
    this.campaigns.set(campaign.id, campaign);
    return Promise.resolve(campaign);
  }

  update(campaign: Campaign): Promise<Campaign> {
    this.campaigns.set(campaign.id, campaign);
    return Promise.resolve(campaign);
  }
}
