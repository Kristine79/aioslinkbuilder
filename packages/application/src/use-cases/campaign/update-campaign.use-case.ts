import type { Campaign } from '@aios/domain';
import { validateCampaign } from '@aios/domain';

import type { UpdateCampaignCommand } from '../../dtos/campaign-commands.js';
import { NotFoundError } from '../../errors.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';

export class UpdateCampaignUseCase {
  constructor(private readonly campaigns: CampaignRepository) {}

  async execute(command: UpdateCampaignCommand): Promise<Campaign> {
    const existing = await this.campaigns.findById(command.id);
    if (existing === null) {
      throw new NotFoundError('Campaign', command.id);
    }
    const fields = command.fields;
    const updated: Campaign = {
      id: existing.id,
      companyId: existing.companyId,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
      name: fields.name ?? existing.name,
      goals: fields.goals ?? existing.goals,
      status: existing.status,
    };
    validateCampaign(updated);
    return this.campaigns.update(updated);
  }
}
