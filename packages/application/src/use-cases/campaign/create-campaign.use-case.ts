import type { Campaign } from '@aios/domain';
import { validateCampaign } from '@aios/domain';

import type { CreateCampaignCommand } from '../../dtos/campaign-commands.js';
import { NotFoundError } from '../../errors.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';

export class CreateCampaignUseCase {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly campaigns: CampaignRepository,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: CreateCampaignCommand): Promise<Campaign> {
    validateCampaign(command);
    const company = await this.companies.findById(command.companyId);
    if (company === null) {
      throw new NotFoundError('Company', command.companyId);
    }
    const campaign = await this.campaigns.create(command);
    await this.auditLog.append({
      actor: 'system',
      action: 'CAMPAIGN_CREATED',
      entityType: 'Campaign',
      entityId: campaign.id,
      metadata: null,
    });
    return campaign;
  }
}
