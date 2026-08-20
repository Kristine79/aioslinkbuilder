import type { PlacementOpportunity } from '@aios/domain';
import {
  ValidationError,
  completeDiscoveryRun,
  failDiscoveryRun,
  startDiscoveryRun,
  validateOpportunity,
} from '@aios/domain';

import type { DiscoverOpportunitiesCommand } from '../../dtos/opportunity-commands.js';
import { NotFoundError } from '../../errors.js';
import type { PlatformDiscoverySource } from '../../ports/discovery-sources.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { DiscoveryRunRepository } from '../../ports/repositories/discovery-run.repository.js';
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
 * company profile (name, geography, campaign goals) and the campaign's
 * strategy directions (catalog-backed or AI-derived) as search context.
 * Category filtering only applies to categories that exist in the catalog;
 * an AI-derived direction without a catalog category never blocks real
 * search results — the catalog is a normalization/enrichment anchor, not a
 * precondition for discovery.
 *
 * The use case also owns the campaign's discovery run state: it opens the
 * RUNNING run, then writes exactly one terminal state. A source/provider
 * failure becomes FAILED — never COMPLETED_EMPTY. Classification happens
 * after discovery, so the run's classified count is reported back into the
 * same run via {@link recordClassified}.
 */
export class DiscoverOpportunitiesUseCase {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly lookups: LookupRepository,
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly auditLog: AuditLogRepository,
    private readonly sources: readonly PlatformDiscoverySource[],
    private readonly runs: DiscoveryRunRepository,
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

    const run = startDiscoveryRun(command.campaignId, new Date());
    await this.runs.save(run);

    try {
      const opportunities = await this.runSources(command, company, campaign, categoryCodes, run);
      return opportunities;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.runs.save(failDiscoveryRun(run, message, new Date()));
      throw error;
    }
  }

  private async runSources(
    command: DiscoverOpportunitiesCommand,
    company: {
      name: string;
      description: string | null;
      industry: string | null;
      website: string | null;
      geography: string[];
      products: string[];
      targetAudience: string[];
    },
    campaign: { goals: string[] },
    categoryCodes: string[],
    run: Awaited<ReturnType<typeof startDiscoveryRun>>,
  ): Promise<PlacementOpportunity[]> {
    const categories = await this.lookups.listCategories();
    const categoryIdsByCode = new Map(
      categories.map((category) => [category.code.trim().toLowerCase(), category.id]),
    );
    // Catalog categories are anchors for normalization and known placement
    // types — never a precondition for discovery. When none of the passed
    // categories is a known catalog category (e.g. purely AI-derived
    // directions), the filter is disabled instead of silently dropping every
    // real candidate that happens to carry a catalog-agnostic code.
    const catalogCodes = new Set(categories.map((category) => category.code.trim().toLowerCase()));
    const overlapping = categoryCodes
      .map((code) => code.trim().toLowerCase())
      .filter((code) => catalogCodes.has(code));
    const allowedCategoryCodes = overlapping.length === 0 ? null : new Set(overlapping);

    const existing = await this.opportunities.findByCampaignId(command.campaignId);
    const existingPlatformIds = new Set(existing.map((opportunity) => opportunity.platformId));
    const createdPlatformIds = new Set<string>();

    const opportunities: PlacementOpportunity[] = [];
    const sourceNames: string[] = [];
    const strategyDirections = command.strategyDirections ?? [];
    for (const source of this.sources) {
      const result = await source.discover({
        companyName: company.name,
        description: company.description,
        industry: company.industry,
        website: company.website,
        geography: company.geography,
        products: company.products,
        targetAudience: company.targetAudience,
        goals: campaign.goals,
        strategyDirections,
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
        sourceNames.push(source.name);
        opportunities.push(opportunity);
      }
    }
    await this.runs.save(
      completeDiscoveryRun(
        run,
        {
          discoveredCount: opportunities.length,
          classifiedCount: 0,
          sources: [...new Set(sourceNames)],
        },
        new Date(),
      ),
    );
    return opportunities;
  }

  /**
   * Reports how many of the discovered opportunities were classified by the
   * pipeline, keeping the persisted run metadata accurate after discovery.
   */
  async recordClassified(campaignId: string, classifiedCount: number): Promise<void> {
    const run = await this.runs.findLatestForCampaign(campaignId);
    if (run === null || run.status === 'FAILED' || run.status === 'NOT_RUN') {
      return;
    }
    await this.runs.save({ ...run, classifiedCount, updatedAt: new Date() });
  }
}
