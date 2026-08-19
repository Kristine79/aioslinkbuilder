import type { PrismaClient } from '@prisma/client';
import type { AuditLogDraft, AuditLogRepository } from '@aios/application';
import type { AuditLogEntry } from '@aios/domain';

import { toDomainMetadata, toPrismaJson } from './mappers.js';

export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: PrismaClient) {}

  async append(draft: AuditLogDraft): Promise<void> {
    await this.db.auditLog.create({
      data: {
        actor: draft.actor,
        action: draft.action,
        entityType: draft.entityType,
        entityId: draft.entityId,
        metadata: toPrismaJson(draft.metadata),
      },
    });
  }

  async findByEntityIds(entityIds: readonly string[], limit?: number): Promise<AuditLogEntry[]> {
    if (entityIds.length === 0) {
      return [];
    }
    const rows = await this.db.auditLog.findMany({
      where: { entityId: { in: [...entityIds] } },
      orderBy: { timestamp: 'desc' },
      ...(limit !== undefined && limit > 0 ? { take: limit } : {}),
    });
    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      actor: row.actor,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: toDomainMetadata(row.metadata),
    }));
  }
}
