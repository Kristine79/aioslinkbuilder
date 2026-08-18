import type { Placement } from '@aios/domain';
import { ValidationError, assertTransitionPlacement } from '@aios/domain';

import type { MonitorPlacementCommand } from '../../dtos/placement-commands.js';
import { NoProviderAssignedError, NotFoundError } from '../../errors.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { PlacementRepository } from '../../ports/repositories/placement.repository.js';
import type { PlacementProviderRegistry } from '../../ports/provider-registry.js';

/**
 * Polls the provider for the current placement state.
 *
 * Only placements in an active phase (SUBMITTED, PENDING_PUBLICATION) are
 * monitored; other placements are returned unchanged so the UI can refresh
 * idempotently. The provider status string is interpreted deterministically:
 * published / pending / failed / rejected / needs_manual / blocked.
 */
export class MonitorPlacementUseCase {
  constructor(
    private readonly placements: PlacementRepository,
    private readonly providers: PlacementProviderRegistry,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: MonitorPlacementCommand): Promise<Placement> {
    const placement = await this.placements.findById(command.placementId);
    if (placement === null) {
      throw new NotFoundError('Placement', command.placementId);
    }

    if (placement.status !== 'SUBMITTED' && placement.status !== 'PENDING_PUBLICATION') {
      return placement;
    }
    if (placement.providerId === null) {
      throw new NoProviderAssignedError(placement.id);
    }
    if (placement.externalId === null) {
      throw new ValidationError('Placement externalId must be set before monitoring');
    }

    const executionProvider = await this.providers.resolve(placement.providerId);
    const status = await executionProvider.getStatus({ externalId: placement.externalId });

    let next: Placement;
    if (status.status === 'published') {
      assertTransitionPlacement(placement.status, 'PUBLISHED');
      const now = new Date();
      next = {
        ...placement,
        status: 'PUBLISHED',
        publishedAt: status.publishedAt !== null ? new Date(status.publishedAt) : now,
        liveUrl: status.liveUrl ?? placement.liveUrl,
        updatedAt: now,
      };
    } else if (status.status === 'pending_publication' || status.status === 'processing') {
      assertTransitionPlacement(placement.status, 'PENDING_PUBLICATION');
      next = { ...placement, status: 'PENDING_PUBLICATION', updatedAt: new Date() };
    } else if (status.status === 'failed') {
      assertTransitionPlacement(placement.status, 'FAILED');
      next = { ...placement, status: 'FAILED', updatedAt: new Date() };
    } else if (status.status === 'rejected') {
      // Platform-level rejection (e.g. moderation denied) is distinct from
      // an execution error and lands in the REJECTED state.
      assertTransitionPlacement(placement.status, 'REJECTED');
      next = { ...placement, status: 'REJECTED', updatedAt: new Date() };
    } else if (status.status === 'needs_manual') {
      // The platform requires a human step (captcha, phone confirmation,
      // manual review); the placement waits in NEEDS_MANUAL with the
      // responsible party being the human operator.
      assertTransitionPlacement(placement.status, 'NEEDS_MANUAL');
      next = { ...placement, status: 'NEEDS_MANUAL', updatedAt: new Date() };
    } else if (status.status === 'blocked') {
      assertTransitionPlacement(placement.status, 'BLOCKED');
      next = { ...placement, status: 'BLOCKED', updatedAt: new Date() };
    } else {
      next = placement;
    }

    const saved = await this.placements.save(next);
    if (saved.status !== placement.status) {
      await this.auditLog.append({
        actor: 'system',
        action: 'PLACEMENT_STATUS_CHANGED',
        entityType: 'Placement',
        entityId: placement.id,
        metadata: {
          from: placement.status,
          to: saved.status,
          providerStatus: status.status,
        },
      });
    }
    return saved;
  }
}
