import { randomUUID } from 'node:crypto';

import type { AuditLogEntry } from '@aios/domain';
import type { AuditLogDraft, AuditLogRepository } from '@aios/application';

/**
 * In-memory implementation of AuditLogRepository. Used by the prototype
 * demo, the API composition and tests; the Prisma repositories remain the
 * production path. Like the Prisma repository, it owns identity and
 * timestamps on append (ADR-009).
 */
export class InMemoryAuditLogRepository implements AuditLogRepository {
  readonly entries: AuditLogEntry[] = [];

  append(draft: AuditLogDraft): Promise<void> {
    this.entries.push({
      id: randomUUID(),
      timestamp: new Date(),
      actor: draft.actor,
      action: draft.action,
      entityType: draft.entityType,
      entityId: draft.entityId,
      metadata: draft.metadata,
    });
    return Promise.resolve();
  }

  findByEntityIds(entityIds: readonly string[], limit?: number): Promise<AuditLogEntry[]> {
    const requested = new Set(entityIds);
    const matches = this.entries
      .filter((entry) => requested.has(entry.entityId))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return Promise.resolve(limit !== undefined && limit > 0 ? matches.slice(0, limit) : matches);
  }
}
