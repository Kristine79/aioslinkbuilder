import type { PlacementOpportunity } from '@aios/domain';
import { isKnownDatum } from '@aios/domain';
import type { AIProvider } from '@aios/ai';
import { anchorRecommendationSchema, validateAIOutput } from '@aios/ai';

import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';
import type { AIAnalysisRepository } from '../../ports/repositories/ai-analysis.repository.js';
import { loadOpportunityContext } from '../../intel/context.js';
import { writeIntel } from '../../intel/metadata.js';

const SCHEMA_VERSION = '1';

export interface RecommendAnchorCommand {
  opportunityId: string;
  /** Set to true only when a campaign anchor profile actually exists. */
  anchorProfileAvailable?: boolean;
}

/**
 * Anchor strategy recommendation. The AI picks an anchor type (exact/partial
 * match, branded, generic, url, long-tail) based on the target page, the
 * surrounding text and the campaign objective, and explains the choice. When
 * no anchor profile exists, no distribution analysis is claimed.
 */
export class RecommendAnchorUseCase {
  constructor(
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly lookups: LookupRepository,
    private readonly analyses: AIAnalysisRepository,
    private readonly aiProvider: AIProvider,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: RecommendAnchorCommand): Promise<PlacementOpportunity> {
    const context = await loadOpportunityContext(
      {
        opportunities: this.opportunities,
        campaigns: this.campaigns,
        companies: this.companies,
        lookups: this.lookups,
      },
      command.opportunityId,
    );
    const { opportunity, company, platform, intel } = context;

    const page = intel.pageAnalysis;
    const profileAvailable = command.anchorProfileAvailable ?? false;
    const targetKeyword =
      company.products[0] ?? (company.industry ? `услуги ${company.industry}` : null);

    const output = validateAIOutput(
      anchorRecommendationSchema,
      await this.aiProvider.recommendAnchor({
        companyName: company.name,
        platformName: platform.name,
        targetPage: page?.targetPage ?? null,
        surroundingContext: page?.summary ?? null,
        placementObjective: context.campaign.goals[0] ?? 'размещение ссылки',
        targetKeyword: targetKeyword ?? null,
        anchorProfileAvailable: profileAvailable,
        targetPageRelevance:
          page !== null && isKnownDatum(page.topicalRelevance) && typeof page.topicalRelevance.value === 'number'
            ? page.topicalRelevance.value
            : null,
      }),
      'recommendAnchor',
    );

    const anchorStrategy = {
      anchorType: output.anchorType,
      anchor: output.anchor,
      alternatives: [...output.alternatives],
      explanation: output.explanation,
      confidence: output.confidence,
      profileAvailable,
    };

    const metadata = writeIntel(opportunity.metadata, { anchorStrategy });
    const updated = await this.opportunities.update({
      ...opportunity,
      metadata,
      updatedAt: new Date(),
    });

    await this.analyses.create({
      campaignId: opportunity.campaignId,
      analysisType: 'ANCHOR_RECOMMENDATION',
      provider: this.aiProvider.name,
      model: null,
      inputReference: { platformId: opportunity.platformId, profileAvailable },
      structuredOutput: output,
      schemaVersion: SCHEMA_VERSION,
      validationStatus: 'VALID',
    });

    await this.auditLog.append({
      actor: 'system',
      action: 'ANCHOR_RECOMMENDED',
      entityType: 'PlacementOpportunity',
      entityId: opportunity.id,
      metadata: { anchorType: output.anchorType, anchor: output.anchor },
    });

    return updated;
  }
}
