import type { Placement, PlacementOpportunity } from '@aios/domain';
import {
  ValidationError,
  assertTransitionPlacement,
  validateManualPlacementRequest,
  validatePlacement,
} from '@aios/domain';

import type { RequestManualPlacementCommand } from '../../dtos/manual-placement-commands.js';
import { NotFoundError } from '../../errors.js';
import { readIntel } from '../../intel/metadata.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';
import type { PlacementRepository } from '../../ports/repositories/placement.repository.js';
import type { PlacementProviderRegistry } from '../../ports/provider-registry.js';

/**
 * Human-in-the-loop gate for manual placement execution: SELECTED ->
 * NEEDS_MANUAL.
 *
 * Two paths reach this gate:
 * - opportunities aligned to a verified MANUAL provider (placementMethod
 *   MANUAL);
 * - outreach-driven placements (LINK_INSERT / GUEST_POST / …) after the
 *   negotiation reached AGREED — the human executes the placement on the
 *   donor site and records the proof here.
 *
 * A placement record is created in NEEDS_MANUAL so the manual attempt is
 * tracked like any other attempt; the human completes the work off-app and
 * records it via CompleteManualPlacementUseCase.
 */
export class RequestManualPlacementUseCase {
  constructor(
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly placements: PlacementRepository,
    private readonly providers: PlacementProviderRegistry,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: RequestManualPlacementCommand): Promise<Placement> {
    const opportunity = await this.opportunities.findById(command.opportunityId);
    if (opportunity === null) {
      throw new NotFoundError('PlacementOpportunity', command.opportunityId);
    }

    validateManualPlacementRequest({ reason: command.reason });
    assertTransitionPlacement(opportunity.status, 'NEEDS_MANUAL');

    const intel = readIntel(opportunity.metadata);
    const isManual = opportunity.placementMethod === 'MANUAL';
    const isAgreedOutreach =
      opportunity.placementMethod === 'OUTREACH' && intel.outreach?.status === 'AGREED';

    if (!isManual && !isAgreedOutreach) {
      throw new ValidationError(
        `Opportunity ${opportunity.id} is not aligned for manual placement (method ${opportunity.placementMethod}, outreach ${intel.outreach?.status ?? 'none'})`,
      );
    }

    let providerId: string | null = null;
    if (isManual) {
      const providers = await this.providers.listByPlatformId(opportunity.platformId);
      const manualProvider = providers.find(
        (provider) => provider.providerType === 'MANUAL' && provider.capabilitiesVerified,
      );
      if (manualProvider === undefined) {
        throw new ValidationError(
          `No verified manual provider available for platform ${opportunity.platformId}`,
        );
      }
      providerId = manualProvider.id;
    }

    validatePlacement({
      opportunityId: opportunity.id,
      providerId,
      status: 'NEEDS_MANUAL',
    });
    const placement = await this.placements.create({
      opportunityId: opportunity.id,
      providerId,
      status: 'NEEDS_MANUAL',
    });

    const needsManual: PlacementOpportunity = {
      ...opportunity,
      status: 'NEEDS_MANUAL',
      updatedAt: new Date(),
    };
    await this.opportunities.update(needsManual);

    await this.auditLog.append({
      actor: 'system',
      action: 'PLACEMENT_NEEDS_MANUAL',
      entityType: 'Placement',
      entityId: placement.id,
      metadata: { opportunityId: opportunity.id, reason: command.reason },
    });

    return placement;
  }
}
