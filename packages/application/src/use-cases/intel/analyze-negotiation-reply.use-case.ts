import type { NegotiationAnalysis, PlacementOpportunity } from '@aios/domain';
import {
  assertTransitionOutreach,
  emptyNegotiationSession,
} from '@aios/domain';
import { ValidationError } from '@aios/domain';
import type { AIProvider } from '@aios/ai';
import { negotiationAnalysisSchema, validateAIOutput } from '@aios/ai';

import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';
import type { AIAnalysisRepository } from '../../ports/repositories/ai-analysis.repository.js';
import { loadOpportunityContext } from '../../intel/context.js';
import { readIntel, writeIntel } from '../../intel/metadata.js';

const SCHEMA_VERSION = '1';

export interface AnalyzeNegotiationReplyCommand {
  opportunityId: string;
  /** The donor reply pasted by the human. */
  reply: string;
}

/**
 * Negotiation copilot. The human pastes (or receives) a reply from the donor;
 * the AI determines the intent (accepted, rejected, price negotiation, content
 * requirements, link attribute request, needs clarification, manual review)
 * and prepares a suggested response, strategy, recommended price range,
 * fallback and risks. AI prepares — the human approves and sends.
 */
export class AnalyzeNegotiationReplyUseCase {
  constructor(
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly lookups: LookupRepository,
    private readonly analyses: AIAnalysisRepository,
    private readonly aiProvider: AIProvider,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: AnalyzeNegotiationReplyCommand): Promise<PlacementOpportunity> {
    const reply = command.reply.trim();
    if (reply.length === 0) {
      throw new ValidationError('Donor reply must not be empty');
    }
    const context = await loadOpportunityContext(
      {
        opportunities: this.opportunities,
        campaigns: this.campaigns,
        companies: this.companies,
        lookups: this.lookups,
      },
      command.opportunityId,
    );
    const { opportunity, company, platform } = context;
    const intel = readIntel(opportunity.metadata);

    const output = validateAIOutput(
      negotiationAnalysisSchema,
      await this.aiProvider.analyzeNegotiationReply({
        donorReply: reply,
        company: { name: company.name, website: company.website },
        platformName: platform.name,
        placementType: opportunity.placementType,
        campaignGoals: context.campaign.goals,
      }),
      'analyzeNegotiationReply',
    );

    const analysis: NegotiationAnalysis = {
      intent: output.intent,
      donorReply: reply,
      suggestedResponse: output.suggestedResponse,
      strategy: output.strategy,
      recommendedPrice:
        output.recommendedPrice === null
          ? null
          : {
              min: output.recommendedPrice.min,
              max: output.recommendedPrice.max,
              currency: output.recommendedPrice.currency,
            },
      fallbackOption: output.fallbackOption,
      risks: [...output.risks],
      confidence: output.confidence,
      analyzedAt: new Date().toISOString(),
    };

    // The donor reply arrives after the outreach was sent.
    const session = intel.negotiation ?? emptyNegotiationSession();
    const now = new Date().toISOString();
    session.replies.push({ role: 'donor', text: reply, at: now });
    session.analysis = analysis;

    const outreach = intel.outreach;
    let updatedOutreach = outreach;
    if (
      outreach !== null &&
      outreach.status === 'SENT' &&
      (analysis.intent === 'ACCEPTED' ||
        analysis.intent === 'REJECTED' ||
        analysis.intent === 'PRICE_NEGOTIATION' ||
        analysis.intent === 'CONTENT_REQUIREMENTS' ||
        analysis.intent === 'LINK_ATTRIBUTE_REQUEST')
    ) {
      const next = { ...outreach, status: 'REPLIED' as const, updatedAt: now };
      assertTransitionOutreach(outreach.status, 'REPLIED');
      updatedOutreach = next;
    }

    const metadata = writeIntel(opportunity.metadata, {
      negotiation: session,
      ...(updatedOutreach === null ? {} : { outreach: updatedOutreach }),
    });
    const updated = await this.opportunities.update({
      ...opportunity,
      metadata,
      updatedAt: new Date(),
    });

    await this.analyses.create({
      campaignId: opportunity.campaignId,
      analysisType: 'NEGOTIATION_ANALYSIS',
      provider: this.aiProvider.name,
      model: null,
      inputReference: { platformId: opportunity.platformId },
      structuredOutput: output,
      schemaVersion: SCHEMA_VERSION,
      validationStatus: 'VALID',
    });

    await this.auditLog.append({
      actor: 'system',
      action: 'DONOR_REPLY_RECEIVED',
      entityType: 'PlacementOpportunity',
      entityId: opportunity.id,
      metadata: { intent: analysis.intent },
    });
    await this.auditLog.append({
      actor: 'system',
      action: 'NEGOTIATION_ANALYZED',
      entityType: 'PlacementOpportunity',
      entityId: opportunity.id,
      metadata: { intent: analysis.intent },
    });

    return updated;
  }
}
