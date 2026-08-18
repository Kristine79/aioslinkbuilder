import type { PrismaClient, Prisma } from '@prisma/client';
import type { Evidence } from '@aios/domain';
import type { EvidenceDraft, EvidenceRepository } from '@aios/application';

import { toDomainMetadata, toPrismaJson } from './mappers.js';

export class PrismaEvidenceRepository implements EvidenceRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByVerificationId(verificationId: string): Promise<Evidence[]> {
    const rows = await this.db.evidence.findMany({ where: { verificationId } });
    return rows.map(toEvidence);
  }

  async create(draft: EvidenceDraft): Promise<Evidence> {
    const row = await this.db.evidence.create({
      data: {
        verificationId: draft.verificationId,
        type: draft.type,
        url: draft.url,
        content: draft.content,
        metadata: toPrismaJson(draft.metadata),
      },
    });
    return toEvidence(row);
  }
}

function toEvidence(row: Prisma.EvidenceGetPayload<Record<string, never>>): Evidence {
  return {
    id: row.id,
    verificationId: row.verificationId,
    type: row.type,
    url: row.url,
    content: row.content,
    metadata: toDomainMetadata(row.metadata),
    createdAt: row.createdAt,
  };
}
