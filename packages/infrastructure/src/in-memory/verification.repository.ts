import type { Verification, VerificationDraft } from '@aios/domain';
import type { VerificationRepository } from '@aios/application';

import { randomUUID } from 'node:crypto';

/**
 * In-memory implementation of VerificationRepository. Used by the prototype
 * demo, the API composition and tests; the Prisma repositories remain the
 * production path.
 */
export class InMemoryVerificationRepository implements VerificationRepository {
  readonly verifications = new Map<string, Verification>();

  findById(id: string): Promise<Verification | null> {
    return Promise.resolve(this.verifications.get(id) ?? null);
  }

  findByPlacementId(placementId: string): Promise<Verification[]> {
    return Promise.resolve(
      [...this.verifications.values()].filter(
        (verification) => verification.placementId === placementId,
      ),
    );
  }

  create(draft: VerificationDraft): Promise<Verification> {
    const now = new Date();
    const verification: Verification = {
      id: randomUUID(),
      placementId: draft.placementId,
      status: draft.status,
      checkedAt: draft.checkedAt,
      result: draft.result,
      failureReason: draft.failureReason,
      createdAt: now,
      updatedAt: now,
    };
    this.verifications.set(verification.id, verification);
    return Promise.resolve(verification);
  }

  save(verification: Verification): Promise<Verification> {
    this.verifications.set(verification.id, verification);
    return Promise.resolve(verification);
  }
}
