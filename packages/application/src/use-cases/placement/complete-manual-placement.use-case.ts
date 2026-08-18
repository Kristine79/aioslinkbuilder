import type { Placement } from '@aios/domain';
import { assertTransitionPlacement, validateManualPlacementCompletion } from '@aios/domain';

import type { CompleteManualPlacementCommand } from '../../dtos/manual-placement-commands.js';
import { NotFoundError } from '../../errors.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { PlacementRepository } from '../../ports/repositories/placement.repository.js';

/**
 * Records the human-completed manual placement: NEEDS_MANUAL -> PUBLISHED.
 *
 * The human pastes the external reference and public URL of the completed
 * work. The placement becomes PUBLISHED only with that proof — the "no fake
 * success" rule: manual completion without a verifiable result is rejected
 * (externalId and liveUrl are mandatory). Verification still runs afterwards
 * through the normal VerifyPlacementUseCase.
 */
export class CompleteManualPlacementUseCase {
  constructor(
    private readonly placements: PlacementRepository,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: CompleteManualPlacementCommand): Promise<Placement> {
    const placement = await this.placements.findById(command.placementId);
    if (placement === null) {
      throw new NotFoundError('Placement', command.placementId);
    }

    validateManualPlacementCompletion({
      externalId: command.externalId,
      liveUrl: command.liveUrl,
    });
    assertTransitionPlacement(placement.status, 'PUBLISHED');

    const now = new Date();
    const completed: Placement = {
      ...placement,
      status: 'PUBLISHED',
      externalId: command.externalId,
      submittedAt: now,
      publishedAt: now,
      liveUrl: command.liveUrl,
      metadata: {
        ...(placement.metadata ?? {}),
        manual: true,
        notes: command.notes ?? null,
      },
      updatedAt: now,
    };
    const saved = await this.placements.save(completed);

    await this.auditLog.append({
      actor: 'system',
      action: 'PLACEMENT_MANUALLY_PUBLISHED',
      entityType: 'Placement',
      entityId: placement.id,
      metadata: {
        externalId: command.externalId,
        liveUrl: command.liveUrl,
        notes: command.notes ?? null,
      },
    });

    return saved;
  }
}
