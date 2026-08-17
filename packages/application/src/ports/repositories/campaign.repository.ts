import type { Campaign } from '@aios/domain';

export interface CampaignRepository {
  findById(id: string): Promise<Campaign | null>;
  findByCompanyId(companyId: string): Promise<Campaign[]>;
  save(campaign: Campaign): Promise<Campaign>;
}
