import type { PlacementOpportunity } from '@aios/domain';
import type { AIProvider } from '@aios/ai';
import { linkInsertSchema, validateAIOutput } from '@aios/ai';

import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';
import type { AIAnalysisRepository } from '../../ports/repositories/ai-analysis.repository.js';
import { loadOpportunityContext } from '../../intel/context.js';
import { writeIntel } from '../../intel/metadata.js';

const SCHEMA_VERSION = '1';

export interface GenerateLinkInsertCommand {
  opportunityId: string;
  /** Optional human override for the desired anchor. */
  desiredAnchor?: string;
  /** Optional placement objective; falls back to the campaign goal. */
  placementObjective?: string;
}

/**
 * AI link insert assistant for LINK_INSERT opportunities: given the target
 * company, the source page, the surrounding context and the target URL, it
 * produces an anchor, 2-3 alternatives, an insertion point, a 1-3 sentence
 * contextual text and an explanation of why the insertion is natural.
 */
export class GenerateLinkInsertUseCase {
  constructor(
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly lookups: LookupRepository,
    private readonly analyses: AIAnalysisRepository,
    private readonly aiProvider: AIProvider,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: GenerateLinkInsertCommand): Promise<PlacementOpportunity> {
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
    const placementObjective =
      command.placementObjective?.trim() || context.campaign.goals[0] || 'размещение ссылки';

    const output = validateAIOutput(
      linkInsertSchema,
      await this.aiProvider.generateLinkInsert({
        company: {
          name: company.name,
          website: company.website,
          products: company.products,
        },
        platform,
        targetPage: page?.targetPage ?? null,
        surroundingContext: page?.summary ?? null,
        targetUrl: company.website ?? opportunity.platformId,
        desiredAnchor: command.desiredAnchor?.trim() || null,
        placementObjective,
      }),
      'generateLinkInsert',
    );

    const linkInsert = {
      anchor: output.anchor,
      anchorAlternatives: [...output.anchorAlternatives],
      suggestedInsertionPoint: output.suggestedInsertionPoint,
      text: output.text,
      explanation: output.explanation,
      confidence: output.confidence,
      placementObjective,
    };

    const metadata = writeIntel(opportunity.metadata, { linkInsert });
    const updated = await this.opportunities.update({
      ...opportunity,
      metadata,
      updatedAt: new Date(),
    });

    await this.analyses.create({
      campaignId: opportunity.campaignId,
      analysisType: 'LINK_INSERT_PREPARATION',
      provider: this.aiProvider.name,
      model: null,
      inputReference: { platformId: opportunity.platformId, placementObjective },
      structuredOutput: output,
      schemaVersion: SCHEMA_VERSION,
      validationStatus: 'VALID',
    });

    await this.auditLog.append({
      actor: 'system',
      action: 'LINK_INSERT_GENERATED',
      entityType: 'PlacementOpportunity',
      entityId: opportunity.id,
      metadata: { anchor: output.anchor, confidence: output.confidence },
    });

    return updated;
  }
}
