import type { PrismaClient } from '@prisma/client';
import type { AuditLogDraft, AuditLogRepository } from '@aios/application';

import { toPrismaJson } from './mappers.js';

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
}
