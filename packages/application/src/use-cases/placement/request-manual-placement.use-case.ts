import type { Placement, PlacementOpportunity } from '@aios/domain';
import {
  EXECUTION_REQUIRED_CAPABILITIES,
  ValidationError,
  assertTransitionPlacement,
  selectBestProvider,
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
 * Three paths reach this gate:
 * - opportunities aligned to a verified MANUAL provider (placementMethod
 *   MANUAL);
 * - outreach-driven placements (LINK_INSERT / GUEST_POST / …) after the
 *   negotiation reached AGREED — the human executes the placement on the
 *   donor site and records the proof here;
 * - any SELECTED platform that cannot execute automatically right now (no
 *   provider with CREATE+VERIFY is resolvable in the current environment,
 *   e.g. a web-discovered platform without a registered provider). The
 *   platform stays a valid manual target: a placement record is created in
 *   NEEDS_MANUAL without a provider id and the human completes it off-app.
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

    const providers = await this.providers.listByPlatformId(opportunity.platformId);
    // Manual execution is the fallback for platforms that cannot run
    // automatically right now: a web-discovered platform without a registered
    // provider (placementMethod UNKNOWN) is still a valid manual target — a
    // human places the link off-app and records the proof. The platform is
    // neither lost nor treated as an error. Automatic execution stays the
    // preferred path whenever a capable provider is resolvable.
    const automatic = selectBestProvider(providers, EXECUTION_REQUIRED_CAPABILITIES);
    const manualFallback = automatic === null;

    if (!isManual && !isAgreedOutreach && !manualFallback) {
      throw new ValidationError(
        `Opportunity ${opportunity.id} cannot be routed to manual placement (method ${opportunity.placementMethod}, outreach ${intel.outreach?.status ?? 'none'})`,
      );
    }

    let providerId: string | null = null;
    if (isManual) {
      const manualProvider = providers.find(
        (provider) => provider.providerType === 'MANUAL' && provider.capabilitiesVerified,
      );
      providerId = manualProvider?.id ?? null;
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
