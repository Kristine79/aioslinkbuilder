import type { PlacementOpportunity } from '@aios/domain';
import { initialOutreachDraft } from '@aios/domain';
import type { AIProvider } from '@aios/ai';
import { outreachMessageSchema, validateAIOutput } from '@aios/ai';

import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';
import type { AIAnalysisRepository } from '../../ports/repositories/ai-analysis.repository.js';
import { loadOpportunityContext } from '../../intel/context.js';
import { writeIntel } from '../../intel/metadata.js';

const SCHEMA_VERSION = '1';

export interface GenerateOutreachCommand {
  opportunityId: string;
}

/**
 * Outreach assistant. For an approved opportunity the AI generates a subject,
 * the initial message, a shorter version, a personalized opening, the value
 * proposition, the placement request and a CTA using the company information,
 * the target page, the donor profile and the placement type. The draft is
 * created in DRAFT state — sending is strictly human-in-the-loop.
 */
export class GenerateOutreachUseCase {
  constructor(
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly lookups: LookupRepository,
    private readonly analyses: AIAnalysisRepository,
    private readonly aiProvider: AIProvider,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: GenerateOutreachCommand): Promise<PlacementOpportunity> {
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

    const output = validateAIOutput(
      outreachMessageSchema,
      await this.aiProvider.generateOutreach({
        company: {
          name: company.name,
          description: company.description,
          website: company.website,
          products: company.products,
        },
        platform,
        placementType: opportunity.placementType,
        goals: context.campaign.goals,
        pageTitle: intel.pageAnalysis?.pageTitle ?? null,
        pageSummary: intel.pageAnalysis?.summary ?? null,
        anchor: intel.linkInsert?.anchor ?? intel.anchorStrategy?.anchor ?? null,
        linkInsertText: intel.linkInsert?.text ?? null,
      }),
      'generateOutreach',
    );

    const now = new Date().toISOString();
    const outreach = initialOutreachDraft(now);
    outreach.message = {
      subject: output.subject,
      message: output.message,
      shortVersion: output.shortVersion,
      opening: output.opening,
      valueProposition: output.valueProposition,
      placementRequest: output.placementRequest,
      cta: output.cta,
    };

    const metadata = writeIntel(opportunity.metadata, { outreach });
    const updated = await this.opportunities.update({
      ...opportunity,
      metadata,
      updatedAt: new Date(),
    });

    await this.analyses.create({
      campaignId: opportunity.campaignId,
      analysisType: 'OUTREACH_MESSAGE',
      provider: this.aiProvider.name,
      model: null,
      inputReference: { platformId: opportunity.platformId },
      structuredOutput: output,
      schemaVersion: SCHEMA_VERSION,
      validationStatus: 'VALID',
    });

    await this.auditLog.append({
      actor: 'system',
      action: 'OUTREACH_GENERATED',
      entityType: 'PlacementOpportunity',
      entityId: opportunity.id,
      metadata: { subject: output.subject },
    });

    return updated;
  }
}
