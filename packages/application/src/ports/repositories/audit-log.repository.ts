import type { AuditLogEntry } from '@aios/domain';

export interface AuditLogDraft {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Readonly<Record<string, unknown>> | null;
}

export interface AuditLogRepository {
  append(draft: AuditLogDraft): Promise<void>;
  /**
   * Latest entries for the given entity ids, newest first. Used by the
   * delivery layer for the dashboard activity feed.
   */
  findByEntityIds(entityIds: readonly string[], limit?: number): Promise<AuditLogEntry[]>;
}
