import type { PlacementOpportunity } from '@aios/domain';
import { assertTransitionPlacement } from '@aios/domain';

import type { ApproveOpportunityCommand } from '../../dtos/placement-commands.js';
import { NotFoundError } from '../../errors.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';

/**
 * Human approval of a classified opportunity: QUALIFIED -> SELECTED.
 *
 * Approving an opportunity does not mutate external state; it only marks the
 * opportunity as selected so a placement can be prepared for it (PRD section
 * 9: external actions require human approval before execution).
 */
export class ApproveOpportunityUseCase {
  constructor(
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: ApproveOpportunityCommand): Promise<PlacementOpportunity> {
    const opportunity = await this.opportunities.findById(command.opportunityId);
    if (opportunity === null) {
      throw new NotFoundError('PlacementOpportunity', command.opportunityId);
    }

    assertTransitionPlacement(opportunity.status, 'SELECTED');

    const selected: PlacementOpportunity = {
      ...opportunity,
      status: 'SELECTED',
      updatedAt: new Date(),
    };
    const updated = await this.opportunities.update(selected);

    await this.auditLog.append({
      actor: 'system',
      action: 'OPPORTUNITY_SELECTED',
      entityType: 'PlacementOpportunity',
      entityId: opportunity.id,
      metadata: null,
    });

    return updated;
  }
}
