import type { PlacementPlan } from '@aios/domain';
import { placementPlanSchema, validateAIOutput } from '@aios/ai';

import { NoPlacementPlanError, PlanGenerationFailedError } from '../../errors.js';
import {
  assertDecisionMapCoverage,
  buildPlacementPlan,
  loadPlanData,
} from '../../plan/plan-builder.js';
import type { AIAnalysisRepository } from '../../ports/repositories/ai-analysis.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';

export interface GetPlacementPlanCommand {
  campaignId: string;
}

/**
 * Returns the latest generated placement plan for the campaign. The stored
 * AI decision map is re-validated and re-reconciled against the CURRENT
 * deterministic opportunity state, so provider/score changes are always
 * reflected without inventing a new plan.
 */
export class GetPlacementPlanUseCase {
  constructor(
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly analyses: AIAnalysisRepository,
    private readonly lookups: LookupRepository,
  ) {}

  async execute(command: GetPlacementPlanCommand): Promise<PlacementPlan> {
    const data = await loadPlanData(
      {
        campaigns: this.campaigns,
        companies: this.companies,
        analyses: this.analyses,
        lookups: this.lookups,
        opportunities: this.opportunities,
      },
      command.campaignId,
    );

    const stored = await this.analyses.findLatestValidPlacementPlan(command.campaignId);
    if (stored === null) {
      throw new NoPlacementPlanError(command.campaignId);
    }

    let decisionMap;
    try {
      decisionMap = validateAIOutput(
        placementPlanSchema,
        stored.structuredOutput,
        'stored placementPlan',
      );
      assertDecisionMapCoverage(
        data.rows.map((row) => row.opportunity.id),
        decisionMap,
      );
    } catch (error) {
      throw new PlanGenerationFailedError(
        command.campaignId,
        `stored plan is invalid: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return buildPlacementPlan(data, decisionMap, {
      provider: stored.provider,
      model: stored.model,
      schemaVersion: stored.schemaVersion,
      generatedAt: stored.createdAt,
    });
  }
}
