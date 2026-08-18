import type { PlacementOpportunity } from '@aios/domain';
import { ValidationError, validateOpportunity } from '@aios/domain';

import type { DiscoverOpportunitiesCommand } from '../../dtos/opportunity-commands.js';
import { NotFoundError } from '../../errors.js';
import type { PlatformDiscoverySource } from '../../ports/discovery-sources.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';

/**
 * Discovers placement opportunities for a campaign by querying discovery
 * sources. The seeded platform catalog is the first source; additional
 * sources plug in without domain changes.
 *
 * Each discovered platform becomes a DISCOVERED opportunity at most once per
 * campaign. The placement type is campaign-scoped; per-platform refinement
 * happens later during classification. Candidates without a registered
 * catalog platformId are ignored for now. Discovery sources receive the real
 * company profile (name, geography, campaign goals) so future sources can
 * match platforms against the actual company.
 */
export class DiscoverOpportunitiesUseCase {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly lookups: LookupRepository,
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly auditLog: AuditLogRepository,
    private readonly sources: readonly PlatformDiscoverySource[],
  ) {}

  async execute(command: DiscoverOpportunitiesCommand): Promise<PlacementOpportunity[]> {
    const campaign = await this.campaigns.findById(command.campaignId);
    if (campaign === null) {
      throw new NotFoundError('Campaign', command.campaignId);
    }
    const company = await this.companies.findById(campaign.companyId);
    if (company === null) {
      throw new NotFoundError('Company', campaign.companyId);
    }

    const categoryCodes = command.categoryCodes ?? [];
    if (categoryCodes.some((code) => code.trim().length === 0)) {
      throw new ValidationError('Opportunity categoryCodes must not be empty');
    }

    const categories = await this.lookups.listCategories();
    const categoryIdsByCode = new Map(categories.map((category) => [category.code, category.id]));
    const allowedCategoryCodes =
      categoryCodes.length === 0
        ? null
        : new Set(categoryCodes.map((code) => code.trim().toLowerCase()));

    const existing = await this.opportunities.findByCampaignId(command.campaignId);
    const existingPlatformIds = new Set(existing.map((opportunity) => opportunity.platformId));
    const createdPlatformIds = new Set<string>();

    const opportunities: PlacementOpportunity[] = [];
    for (const source of this.sources) {
      const result = await source.discover({
        companyName: company.name,
        geography: company.geography,
        goals: campaign.goals,
      });
      for (const candidate of result.candidates) {
        if (
          allowedCategoryCodes !== null &&
          (candidate.categoryCode === null ||
            !allowedCategoryCodes.has(candidate.categoryCode.trim().toLowerCase()))
        ) {
          continue;
        }
        if (candidate.platformId === null) {
          continue;
        }
        if (
          existingPlatformIds.has(candidate.platformId) ||
          createdPlatformIds.has(candidate.platformId)
        ) {
          continue;
        }
        createdPlatformIds.add(candidate.platformId);
        validateOpportunity({
          campaignId: command.campaignId,
          platformId: candidate.platformId,
          placementType: command.placementType,
          placementMethod: 'UNKNOWN',
        });
        const categoryId =
          candidate.categoryCode === null
            ? null
            : (categoryIdsByCode.get(candidate.categoryCode.trim().toLowerCase()) ?? null);
        const opportunity = await this.opportunities.create({
          campaignId: command.campaignId,
          platformId: candidate.platformId,
          placementType: command.placementType,
          placementMethod: 'UNKNOWN',
          categoryId,
          metadata: { discoverySource: source.name },
        });
        await this.auditLog.append({
          actor: 'system',
          action: 'OPPORTUNITY_DISCOVERED',
          entityType: 'PlacementOpportunity',
          entityId: opportunity.id,
          metadata: { platformId: candidate.platformId, source: source.name },
        });
        opportunities.push(opportunity);
      }
    }
    return opportunities;
  }
}
