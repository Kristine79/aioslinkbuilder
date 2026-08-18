import type { Placement, PlacementStatus } from '@aios/domain';
import type { PlacementRepository } from '@aios/application';

import { randomUUID } from 'node:crypto';

/**
 * In-memory implementation of PlacementRepository. Used by the prototype
 * demo, the API composition and tests; the Prisma repositories remain the
 * production path.
 */
export class InMemoryPlacementRepository implements PlacementRepository {
  readonly placements = new Map<string, Placement>();

  findById(id: string): Promise<Placement | null> {
    return Promise.resolve(this.placements.get(id) ?? null);
  }

  findByOpportunityId(opportunityId: string): Promise<Placement[]> {
    return Promise.resolve(
      [...this.placements.values()].filter(
        (placement) => placement.opportunityId === opportunityId,
      ),
    );
  }

  create(draft: {
    opportunityId: string;
    providerId: string | null;
    status?: PlacementStatus;
  }): Promise<Placement> {
    const now = new Date();
    const placement: Placement = {
      id: randomUUID(),
      opportunityId: draft.opportunityId,
      providerId: draft.providerId,
      status: draft.status ?? 'READY',
      externalId: null,
      submittedAt: null,
      publishedAt: null,
      liveUrl: null,
      metadata: null,
      createdAt: now,
      updatedAt: now,
    };
    this.placements.set(placement.id, placement);
    return Promise.resolve(placement);
  }

  save(placement: Placement): Promise<Placement> {
    this.placements.set(placement.id, placement);
    return Promise.resolve(placement);
  }
}
