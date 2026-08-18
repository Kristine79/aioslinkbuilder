import type { Campaign, CampaignDraft } from '@aios/domain';

export interface CampaignRepository {
  findById(id: string): Promise<Campaign | null>;
  findByCompanyId(companyId: string): Promise<Campaign[]>;
  create(draft: CampaignDraft): Promise<Campaign>;
  update(campaign: Campaign): Promise<Campaign>;
}
