import type { Campaign } from '@aios/domain';

import { NotFoundError } from '../../errors.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';

export class GetCampaignUseCase {
  constructor(private readonly campaigns: CampaignRepository) {}

  async execute(id: string): Promise<Campaign> {
    const campaign = await this.campaigns.findById(id);
    if (campaign === null) {
      throw new NotFoundError('Campaign', id);
    }
    return campaign;
  }
}
