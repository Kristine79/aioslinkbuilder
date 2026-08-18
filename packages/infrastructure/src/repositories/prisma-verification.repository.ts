import type { PrismaClient, Prisma } from '@prisma/client';
import type { Verification, VerificationDraft } from '@aios/domain';
import type { VerificationRepository } from '@aios/application';

import { toDomainMetadata, toPrismaJson } from './mappers.js';

export class PrismaVerificationRepository implements VerificationRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<Verification | null> {
    const row = await this.db.verification.findUnique({ where: { id } });
    return row === null ? null : toVerification(row);
  }

  async findByPlacementId(placementId: string): Promise<Verification[]> {
    const rows = await this.db.verification.findMany({ where: { placementId } });
    return rows.map(toVerification);
  }

  async create(draft: VerificationDraft): Promise<Verification> {
    const row = await this.db.verification.create({
      data: {
        placementId: draft.placementId,
        status: draft.status,
        checkedAt: draft.checkedAt,
        result: toPrismaJson(draft.result),
        failureReason: draft.failureReason,
      },
    });
    return toVerification(row);
  }

  async save(verification: Verification): Promise<Verification> {
    const row = await this.db.verification.upsert({
      where: { id: verification.id },
      create: {
        id: verification.id,
        placementId: verification.placementId,
        status: verification.status,
        checkedAt: verification.checkedAt,
        result: toPrismaJson(verification.result),
        failureReason: verification.failureReason,
        createdAt: verification.createdAt,
      },
      update: {
        status: verification.status,
        checkedAt: verification.checkedAt,
        result: toPrismaJson(verification.result),
        failureReason: verification.failureReason,
      },
    });
    return toVerification(row);
  }
}

function toVerification(row: Prisma.VerificationGetPayload<Record<string, never>>): Verification {
  return {
    id: row.id,
    placementId: row.placementId,
    status: row.status,
    checkedAt: row.checkedAt,
    result: toDomainMetadata(row.result),
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
