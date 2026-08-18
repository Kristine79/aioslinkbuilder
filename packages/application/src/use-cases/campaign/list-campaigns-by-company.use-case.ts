import type { Campaign } from '@aios/domain';

import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';

export class ListCampaignsByCompanyUseCase {
  constructor(private readonly campaigns: CampaignRepository) {}

  async execute(companyId: string): Promise<Campaign[]> {
    return this.campaigns.findByCompanyId(companyId);
  }
}
