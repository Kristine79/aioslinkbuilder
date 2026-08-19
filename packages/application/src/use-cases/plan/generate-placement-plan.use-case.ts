import type { PlacementPlan } from '@aios/domain';
import type { AIProvider } from '@aios/ai';
import { placementPlanSchema, validateAIOutput } from '@aios/ai';

import { PlanGenerationFailedError } from '../../errors.js';
import {
  assertDecisionMapCoverage,
  buildPlacementPlan,
  loadPlanData,
  planAiInput,
  PLAN_SCHEMA_VERSION,
} from '../../plan/plan-builder.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { AIAnalysisRepository } from '../../ports/repositories/ai-analysis.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';

export interface GeneratePlacementPlanCommand {
  campaignId: string;
}

/**
 * Generates the campaign placement plan (AI Placement Decision Engine).
 *
 * The use case operates ONLY on opportunities already discovered by the
 * system. The AI receives the whole opportunity set in one batch operation
 * and returns a schema-validated decision map (interpretation of the
 * existing signals); the domain planner reconciles every suggestion with the
 * deterministic score/risk/provider/strategy state before the plan is
 * exposed. The final numbers always come from the deterministic engine.
 *
 * If the AI fails or returns malformed output, no plan is fabricated: the
 * audit trail records the failure and the caller receives a clear error —
 * the underlying opportunities remain inspectable.
 */
export class GeneratePlacementPlanUseCase {
  constructor(
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly analyses: AIAnalysisRepository,
    private readonly lookups: LookupRepository,
    private readonly aiProvider: AIProvider,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: GeneratePlacementPlanCommand): Promise<PlacementPlan> {
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

    let decisionMap;
    try {
      decisionMap = validateAIOutput(
        placementPlanSchema,
        await this.aiProvider.generatePlacementPlan(planAiInput(data)),
        'generatePlacementPlan',
      );
      assertDecisionMapCoverage(
        data.rows.map((row) => row.opportunity.id),
        decisionMap,
      );
    } catch (error) {
      await this.auditLog.append({
        actor: 'system',
        action: 'PLACEMENT_PLAN_GENERATED',
        entityType: 'Campaign',
        entityId: data.campaign.id,
        metadata: {
          status: 'FAILED',
          reason: safeReason(error),
        },
      });
      throw new PlanGenerationFailedError(data.campaign.id, failureKind(error));
    }

    const plan = buildPlacementPlan(data, decisionMap, {
      provider: this.aiProvider.name,
      model: null,
      schemaVersion: PLAN_SCHEMA_VERSION,
      generatedAt: new Date(),
    });

    await this.analyses.create({
      campaignId: data.campaign.id,
      analysisType: 'PLACEMENT_PLAN',
      provider: this.aiProvider.name,
      model: null,
      inputReference: { opportunityCount: data.rows.length },
      structuredOutput: decisionMap,
      schemaVersion: PLAN_SCHEMA_VERSION,
      validationStatus: 'VALID',
    });

    await this.auditLog.append({
      actor: 'system',
      action: 'PLACEMENT_PLAN_GENERATED',
      entityType: 'Campaign',
      entityId: data.campaign.id,
      metadata: {
        status: 'COMPLETE',
        provider: this.aiProvider.name,
        opportunityCount: plan.summary.total,
        recommended: plan.summary.recommended,
        reviewRequired: plan.summary.reviewRequired,
        notRecommended: plan.summary.notRecommended,
        insufficientData: plan.summary.insufficientData,
        automationPercent: plan.summary.automationPercent,
      },
    });

    return plan;
  }
}

/** Strips internal error details for the public error message. */
function failureKind(error: unknown): string {
  if (error instanceof Error && error.name === 'AIOutputValidationError') {
    return 'AI output failed schema validation';
  }
  if (error instanceof Error && error.name === 'PlanCoverageError') {
    return 'AI decision map does not cover the discovered opportunities';
  }
  return 'AI provider failed to produce a decision map';
}

function safeReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
