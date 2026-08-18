import type { PlacementOpportunity, PlacementCategory, ScoreBreakdown } from '@aios/domain';
import {
  EXECUTION_REQUIRED_CAPABILITIES,
  assertTransitionPlacement,
  calculateScoreBreakdown,
  deriveProviderAlignment,
} from '@aios/domain';
import type { AIProvider } from '@aios/ai';
import { companyAnalysisSchema, opportunityClassificationSchema, validateAIOutput } from '@aios/ai';

import type { ClassifyOpportunityCommand } from '../../dtos/opportunity-commands.js';
import { NoCompanyAnalysisError, NotFoundError } from '../../errors.js';
import type { AIAnalysisRepository } from '../../ports/repositories/ai-analysis.repository.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';
import type { PlacementProviderRegistry } from '../../ports/provider-registry.js';

/**
 * Neutral value used for deterministic score dimensions (authority, placement
 * quality, automation potential) when no measured value is available yet.
 * Unknown dimensions are neither rewarded nor penalized.
 */
const NEUTRAL_DETERMINISTIC_SCORE = 50;

/** Version of the opportunity classification schema contract stored on AIAnalysis records. */
const CLASSIFICATION_SCHEMA_VERSION = '1';

/**
 * Classifies a discovered opportunity with AI and scores it deterministically.
 *
 * The AI provider supplies the semantic dimensions (topical relevance,
 * audience match, geographic relevance) and the placement type. Deterministic
 * dimensions come from the command (or default to neutral). The final score is
 * always computed by the domain layer; AI never writes a score directly.
 *
 * Provider alignment is read from the PlacementProviderRegistry — the same
 * single source of truth that ExecutePlacementUseCase uses — so the method
 * and capabilities recorded at classification can never disagree with what
 * execution sees (including environment policy such as the demo/production
 * MOCK distinction).
 */
export class ClassifyOpportunityUseCase {
  constructor(
    private readonly aiProvider: AIProvider,
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly analyses: AIAnalysisRepository,
    private readonly lookups: LookupRepository,
    private readonly providers: PlacementProviderRegistry,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: ClassifyOpportunityCommand): Promise<PlacementOpportunity> {
    const opportunity = await this.opportunities.findById(command.opportunityId);
    if (opportunity === null) {
      throw new NotFoundError('PlacementOpportunity', command.opportunityId);
    }

    const companyAnalysis = await this.loadCompanyAnalysis(opportunity.campaignId);
    const platform = await this.loadPlatformMetadata(opportunity.platformId);

    const classification = await this.aiProvider.classifyOpportunity({
      platform,
      pageMetadata: opportunity.metadata,
      companyAnalysis,
    });
    const validated = validateAIOutput(
      opportunityClassificationSchema,
      classification,
      'classifyOpportunity',
    );

    const categories = await this.lookups.listCategories();
    const breakdown = calculateScoreBreakdown({
      topicalRelevance: validated.topicalRelevance,
      audienceMatch: validated.audienceMatch,
      geographicRelevance: validated.geographicRelevance,
      authority: command.deterministicScores?.authority ?? NEUTRAL_DETERMINISTIC_SCORE,
      placementQuality:
        command.deterministicScores?.placementQuality ?? NEUTRAL_DETERMINISTIC_SCORE,
      automationPotential:
        command.deterministicScores?.automationPotential ?? NEUTRAL_DETERMINISTIC_SCORE,
    });

    assertTransitionPlacement(opportunity.status, 'QUALIFIED');

    const alignment = await this.loadProviderAlignment(opportunity.platformId);

    const classified: PlacementOpportunity = {
      ...opportunity,
      categoryId: resolveCategoryId(categories, validated.category),
      placementType: validated.placementType,
      relevance: validated.recommendationReason,
      score: breakdown.total,
      scoreBreakdown: breakdown,
      recommendation: validated.recommendationReason,
      whyRecommended: describeBreakdown(breakdown),
      placementMethod: alignment.method,
      providerCapabilities: alignment.provider?.capabilities ?? [],
      status: 'QUALIFIED',
      updatedAt: new Date(),
    };

    const updated = await this.opportunities.update(classified);

    await this.analyses.create({
      campaignId: opportunity.campaignId,
      analysisType: 'OPPORTUNITY_CLASSIFICATION',
      provider: this.aiProvider.name,
      model: null,
      inputReference: {
        platformId: opportunity.platformId,
        pageMetadata: opportunity.metadata,
      },
      structuredOutput: validated,
      schemaVersion: CLASSIFICATION_SCHEMA_VERSION,
      validationStatus: 'VALID',
    });

    await this.auditLog.append({
      actor: 'system',
      action: 'OPPORTUNITY_CLASSIFIED',
      entityType: 'PlacementOpportunity',
      entityId: opportunity.id,
      metadata: {
        categoryId: classified.categoryId,
        placementType: classified.placementType,
        score: classified.score,
        placementMethod: classified.placementMethod,
        providerId: alignment.provider?.id ?? null,
      },
    });

    return updated;
  }

  private async loadCompanyAnalysis(campaignId: string) {
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

  private async loadProviderAlignment(platformId: string) {
    const providers = await this.providers.listByPlatformId(platformId);
    return deriveProviderAlignment(providers, EXECUTION_REQUIRED_CAPABILITIES);
  }

  private async loadPlatformMetadata(platformId: string) {
    const platforms = await this.lookups.listPlatforms();
    const platform = platforms.find((candidate) => candidate.id === platformId);
    if (platform === undefined) {
      throw new NotFoundError('Platform', platformId);
    }
    const categories = await this.lookups.listCategories();
    const category = categories.find((candidate) => candidate.id === platform.categoryId);
    return {
      name: platform.name,
      url: platform.url,
      category: category?.name ?? null,
    };
  }
}

export function resolveCategoryId(
  categories: PlacementCategory[],
  rawCategory: string,
): string | null {
  const normalized = rawCategory.trim().toLowerCase();
  const match = categories.find(
    (category) =>
      category.code.toLowerCase() === normalized || category.name.toLowerCase() === normalized,
  );
  return match?.id ?? null;
}

export function describeBreakdown(breakdown: ScoreBreakdown): string {
  return (
    `Тематическая релевантность ${breakdown.topicalRelevance}/100, ` +
    `совпадение аудитории ${breakdown.audienceMatch}/100, ` +
    `географическая релевантность ${breakdown.geographicRelevance}/100, ` +
    `авторитетность ${breakdown.authority}/100, ` +
    `качество размещения ${breakdown.placementQuality}/100, ` +
    `потенциал автоматизации ${breakdown.automationPotential}/100`
  );
}
