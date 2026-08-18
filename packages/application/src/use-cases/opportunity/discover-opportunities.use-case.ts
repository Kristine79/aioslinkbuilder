import type { PlacementOpportunity } from '@aios/domain';
import { ValidationError, validateOpportunity } from '@aios/domain';

import type { DiscoverOpportunitiesCommand } from '../../dtos/opportunity-commands.js';
import { NotFoundError } from '../../errors.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';

/**
 * Discovers placement opportunities for a campaign from the platform catalog.
 *
 * Each catalog platform becomes a DISCOVERED opportunity at most once per
 * campaign. The placement type is campaign-scoped; per-platform refinement
 * happens later during classification.
 */
export class DiscoverOpportunitiesUseCase {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly lookups: LookupRepository,
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: DiscoverOpportunitiesCommand): Promise<PlacementOpportunity[]> {
    const campaign = await this.campaigns.findById(command.campaignId);
    if (campaign === null) {
      throw new NotFoundError('Campaign', command.campaignId);
    }

    const categoryCodes = command.categoryCodes ?? [];
    if (categoryCodes.some((code) => code.trim().length === 0)) {
      throw new ValidationError('Opportunity categoryCodes must not be empty');
    }

    const categories = await this.lookups.listCategories();
    const categoryIdsByCode = new Map(categories.map((category) => [category.code, category.id]));
    const allowedCategoryIds =
      categoryCodes.length === 0
        ? null
        : new Set(
            categoryCodes
              .map((code) => categoryIdsByCode.get(code))
              .filter((id): id is string => id != null),
          );

    const platforms = await this.lookups.listPlatforms();
    const existing = await this.opportunities.findByCampaignId(command.campaignId);
    const existingPlatformIds = new Set(existing.map((opportunity) => opportunity.platformId));

    const opportunities: PlacementOpportunity[] = [];
    for (const platform of platforms) {
      if (
        allowedCategoryIds !== null &&
        (platform.categoryId === null || !allowedCategoryIds.has(platform.categoryId))
      ) {
        continue;
      }
      if (existingPlatformIds.has(platform.id)) {
        continue;
      }
      validateOpportunity({
        campaignId: command.campaignId,
        platformId: platform.id,
        placementType: command.placementType,
        placementMethod: 'UNKNOWN',
      });
      const opportunity = await this.opportunities.create({
        campaignId: command.campaignId,
        platformId: platform.id,
        placementType: command.placementType,
        placementMethod: 'UNKNOWN',
      });
      await this.auditLog.append({
        actor: 'system',
        action: 'OPPORTUNITY_DISCOVERED',
        entityType: 'PlacementOpportunity',
        entityId: opportunity.id,
        metadata: { platformId: platform.id },
      });
      opportunities.push(opportunity);
    }
    return opportunities;
  }
}
