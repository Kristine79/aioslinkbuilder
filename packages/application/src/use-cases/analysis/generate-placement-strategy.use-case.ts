import type { PlacementStrategy, PlacementStrategyItem } from '@aios/domain';
import { DEFAULT_PLACEMENT_TYPE, placementTypeForCategory } from '@aios/domain';
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
    const catalogByCode = new Map(
      categories.map((category) => [category.code.toLowerCase(), category]),
    );
    // Keep the original AI spelling for AI-derived directions while matching
    // catalog categories case-insensitively.
    const relevantEntries: Array<{ code: string; raw: string }> = [];
    const seen = new Set<string>();
    for (const entry of validated.relevantCategories) {
      const raw = entry.trim();
      const code = raw.toLowerCase();
      if (code === '' || seen.has(code)) continue;
      seen.add(code);
      relevantEntries.push({ code, raw });
    }

    const catalogItems: PlacementStrategyItem[] = [];
    const aiDerivedItems: PlacementStrategyItem[] = [];
    for (const { code, raw } of relevantEntries) {
      const category = catalogByCode.get(code);
      if (category === undefined) {
        // AI-derived direction: relevant for the company, not represented in
        // the catalog yet. It stays an active strategy direction and can be
        // passed into discovery without a catalog category.
        aiDerivedItems.push({
          categoryId: null,
          categoryCode: raw,
          categoryName: raw,
          placementType: DEFAULT_PLACEMENT_TYPE,
        });
        continue;
      }
      catalogItems.push({
        categoryId: category.id,
        categoryCode: category.code,
        categoryName: category.name,
        placementType: placementTypeForCategory(category),
      });
    }

    return {
      campaignId: campaign.id,
      generatedAt: new Date(),
      // Catalog-backed directions come first; AI-derived directions follow so
      // every relevant direction stays active — a missing catalog category
      // never removes a strategy direction. Catalog matching remains useful
      // for normalization, known placement types and provider alignment.
      items: [...catalogItems, ...aiDerivedItems],
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
