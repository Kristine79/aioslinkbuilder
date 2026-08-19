import type { PlacementOpportunity } from '@aios/domain';
import { assertTransitionOutreach, ValidationError } from '@aios/domain';

import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';
import { loadOpportunityContext } from '../../intel/context.js';
import { readIntel, writeIntel } from '../../intel/metadata.js';

export interface RespondNegotiationCommand {
  opportunityId: string;
  /** True = the human accepts the AI-prepared response/terms. */
  agree: boolean;
  /** Optional human-written response that overrides the AI draft. */
  customResponse?: string;
}

/**
 * The human approves and (optionally) sends the AI-prepared negotiation
 * response. Accepting marks the negotiation RESOLVED and moves outreach to
 * AGREED; rejecting marks it REJECTED. If the human only sends a reply
 * without a final decision, the thread stays OPEN.
 */
export class RespondNegotiationUseCase {
  constructor(
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly lookups: LookupRepository,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: RespondNegotiationCommand): Promise<PlacementOpportunity> {
    const context = await loadOpportunityContext(
      {
        opportunities: this.opportunities,
        campaigns: this.campaigns,
        companies: this.companies,
        lookups: this.lookups,
      },
      command.opportunityId,
    );
    const { opportunity } = context;
    const intel = readIntel(opportunity.metadata);

    const session = intel.negotiation;
    if (session === null || session.analysis === null) {
      throw new ValidationError('No negotiation analysis found — analyze the donor reply first');
    }
    const outreach = intel.outreach;
    if (outreach === null) {
      throw new ValidationError('Outreach has not been prepared for this opportunity');
    }

    const now = new Date().toISOString();
    const hasCustomResponse =
      command.customResponse !== undefined && command.customResponse.trim().length > 0;
    const response = hasCustomResponse
      ? command.customResponse!.trim()
      : command.agree
        ? 'Согласовано, размещаем.'
        : 'Отклоняем.';
    session.replies.push({ role: 'human', text: response, at: now });

    let nextOutreach = outreach;
    if (command.agree) {
      if (outreach.status !== 'AGREED') {
        assertTransitionOutreach(outreach.status, 'AGREED');
        nextOutreach = { ...outreach, status: 'AGREED', updatedAt: now };
      }
      session.status = 'RESOLVED';
    } else if (hasCustomResponse) {
      // The human keeps negotiating with their own reply.
      if (outreach.status === 'REPLIED') {
        assertTransitionOutreach(outreach.status, 'NEGOTIATING');
        nextOutreach = { ...outreach, status: 'NEGOTIATING', updatedAt: now };
      }
    } else if (outreach.status === 'REPLIED' || outreach.status === 'NEGOTIATING') {
      assertTransitionOutreach(outreach.status, 'REJECTED');
      nextOutreach = { ...outreach, status: 'REJECTED', updatedAt: now };
      session.status = 'RESOLVED';
    }

    const metadata = writeIntel(opportunity.metadata, {
      negotiation: session,
      outreach: nextOutreach,
    });
    const updated = await this.opportunities.update({
      ...opportunity,
      metadata,
      updatedAt: new Date(),
    });

    await this.auditLog.append({
      actor: 'user',
      action: command.agree ? 'NEGOTIATION_AGREED' : 'NEGOTIATION_RESPONDED',
      entityType: 'PlacementOpportunity',
      entityId: opportunity.id,
      metadata: { outreachStatus: nextOutreach.status, response },
    });

    return updated;
  }
}
