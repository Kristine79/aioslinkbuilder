import type { Evidence, EvidenceDraft } from '@aios/domain';
import type { EvidenceRepository } from '@aios/application';

import { randomUUID } from 'node:crypto';

/**
 * In-memory implementation of EvidenceRepository. Used by the prototype
 * demo, the API composition and tests; the Prisma repositories remain the
 * production path.
 */
export class InMemoryEvidenceRepository implements EvidenceRepository {
  readonly evidence = new Map<string, Evidence>();

  findByVerificationId(verificationId: string): Promise<Evidence[]> {
    return Promise.resolve(
      [...this.evidence.values()].filter((entry) => entry.verificationId === verificationId),
    );
  }

  create(draft: EvidenceDraft): Promise<Evidence> {
    const entry: Evidence = {
      id: randomUUID(),
      verificationId: draft.verificationId,
      type: draft.type,
      url: draft.url,
      content: draft.content,
      metadata: draft.metadata,
      createdAt: new Date(),
    };
    this.evidence.set(entry.id, entry);
    return Promise.resolve(entry);
  }
}
