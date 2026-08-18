import type { PrismaClient, Prisma } from '@prisma/client';
import type { Placement, PlacementDraft } from '@aios/domain';
import type { PlacementRepository } from '@aios/application';

import { toDomainMetadata, toPrismaJson } from './mappers.js';

export class PrismaPlacementRepository implements PlacementRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<Placement | null> {
    const row = await this.db.placement.findUnique({ where: { id } });
    return row === null ? null : toPlacement(row);
  }

  async findByOpportunityId(opportunityId: string): Promise<Placement[]> {
    const rows = await this.db.placement.findMany({ where: { opportunityId } });
    return rows.map(toPlacement);
  }

  async create(draft: PlacementDraft): Promise<Placement> {
    const row = await this.db.placement.create({
      data: {
        opportunityId: draft.opportunityId,
        providerId: draft.providerId,
        status: draft.status ?? 'READY',
      },
    });
    return toPlacement(row);
  }

  async save(placement: Placement): Promise<Placement> {
    const row = await this.db.placement.upsert({
      where: { id: placement.id },
      create: {
        id: placement.id,
        opportunityId: placement.opportunityId,
        providerId: placement.providerId,
        status: placement.status,
        externalId: placement.externalId,
        submittedAt: placement.submittedAt,
        publishedAt: placement.publishedAt,
        liveUrl: placement.liveUrl,
        metadata: toPrismaJson(placement.metadata),
        createdAt: placement.createdAt,
      },
      update: {
        providerId: placement.providerId,
        status: placement.status,
        externalId: placement.externalId,
        submittedAt: placement.submittedAt,
        publishedAt: placement.publishedAt,
        liveUrl: placement.liveUrl,
        metadata: toPrismaJson(placement.metadata),
      },
    });
    return toPlacement(row);
  }
}

function toPlacement(row: Prisma.PlacementGetPayload<Record<string, never>>): Placement {
  return {
    id: row.id,
    opportunityId: row.opportunityId,
    providerId: row.providerId,
    status: row.status,
    externalId: row.externalId,
    submittedAt: row.submittedAt,
    publishedAt: row.publishedAt,
    liveUrl: row.liveUrl,
    metadata: toDomainMetadata(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
