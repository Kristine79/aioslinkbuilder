import type { OutreachStatus, PlacementOpportunity } from '@aios/domain';
import { assertTransitionOutreach } from '@aios/domain';
import { ValidationError } from '@aios/domain';

import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';
import type { OutreachProvider } from '../../ports/outreach-provider.js';
import { loadOpportunityContext } from '../../intel/context.js';
import { readIntel, writeIntel } from '../../intel/metadata.js';

export interface UpdateOutreachStatusCommand {
  opportunityId: string;
  status: OutreachStatus;
}

/**
 * Human-in-the-loop outreach state transitions.
 *
 * The status machine is enforced by the domain (DRAFT → READY_FOR_REVIEW →
 * APPROVED → SENT → REPLIED/NEGOTIATING → AGREED/REJECTED). Only the
 * APPROVED → SENT transition invokes the messaging provider, and it is only
 * ever triggered by an explicit human action (the "send" button). Sending is
 * never automatic.
 */
export class UpdateOutreachStatusUseCase {
  constructor(
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly lookups: LookupRepository,
    private readonly outreachProvider: OutreachProvider | null,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: UpdateOutreachStatusCommand): Promise<PlacementOpportunity> {
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
    const outreach = intel.outreach;
    if (outreach === null) {
      throw new ValidationError('Outreach has not been prepared for this opportunity yet');
    }
    if (outreach.message === null) {
      throw new ValidationError('Outreach message is empty');
    }

    assertTransitionOutreach(outreach.status, command.status);

    const next: typeof outreach = { ...outreach, status: command.status, updatedAt: new Date().toISOString() };

    if (command.status === 'SENT') {
      let provider = outreach.provider;
      let externalId = outreach.externalId;
      if (this.outreachProvider !== null) {
        const result = await this.outreachProvider.send({
          to: context.platform.name,
          subject: outreach.message.subject,
          body: outreach.message.message,
        });
        provider = this.outreachProvider.name;
        externalId = result.externalId;
      } else {
        provider = 'manual';
      }
      next.provider = provider;
      next.externalId = externalId;
      next.sentAt = new Date().toISOString();
    }

    const metadata = writeIntel(opportunity.metadata, { outreach: next });
    const updated = await this.opportunities.update({
      ...opportunity,
      metadata,
      updatedAt: new Date(),
    });

    await this.auditLog.append({
      actor: 'system',
      action: command.status === 'SENT' ? 'OUTREACH_SENT' : 'OUTREACH_STATUS_CHANGED',
      entityType: 'PlacementOpportunity',
      entityId: opportunity.id,
      metadata: {
        from: outreach.status,
        to: command.status,
        provider: next.provider,
        externalId: next.externalId,
      },
    });

    return updated;
  }
}
