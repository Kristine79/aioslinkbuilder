import type { PlacementStrategy } from '@aios/domain';
import { placementTypeForCategory } from '@aios/domain';
import type { CompanyAnalysis } from '@aios/ai';
import { companyAnalysisSchema, validateAIOutput } from '@aios/ai';

import type { GeneratePlacementStrategyCommand } from '../../dtos/analysis-commands.js';
import { NoCompanyAnalysisError, NotFoundError } from '../../errors.js';
import type { AIAnalysisRepository } from '../../ports/repositories/ai-analysis.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';

/**
 * Generates the deterministic placement strategy for a campaign.
 *
 * The AI contributes the relevant categories and strategic recommendations
 * (via the stored, validated company analysis); the mapping from category to
 * placement type is deterministic domain data. The strategy is derived on
 * demand and does not need its own persistence.
 */
export class GeneratePlacementStrategyUseCase {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly analyses: AIAnalysisRepository,
    private readonly lookups: LookupRepository,
  ) {}

  async execute(command: GeneratePlacementStrategyCommand): Promise<PlacementStrategy> {
    const campaign = await this.campaigns.findById(command.campaignId);
    if (campaign === null) {
      throw new NotFoundError('Campaign', command.campaignId);
    }
    const company = await this.companies.findById(campaign.companyId);
    if (company === null) {
      throw new NotFoundError('Company', campaign.companyId);
    }
    const validated = await this.loadCompanyAnalysis(command.campaignId);

    const categories = await this.lookups.listCategories();
    const relevantCodes = new Set(
      validated.relevantCategories.map((code) => code.trim().toLowerCase()),
    );

    return {
      campaignId: campaign.id,
      generatedAt: new Date(),
      items: categories
        .filter((category) => relevantCodes.has(category.code.toLowerCase()))
        .map((category) => ({
          categoryId: category.id,
          categoryCode: category.code,
          categoryName: category.name,
          placementType: placementTypeForCategory(category),
        })),
      recommendations: validated.strategicRecommendations,
    };
  }

  private async loadCompanyAnalysis(campaignId: string): Promise<CompanyAnalysis> {
    const analysis = await this.analyses.findLatestValidCompanyAnalysis(campaignId);
    if (analysis === null) {
      throw new NoCompanyAnalysisError(campaignId);
    }
    return validateAIOutput(
      companyAnalysisSchema,
      analysis.structuredOutput,
      'stored companyAnalysis',
    );
  }
}
