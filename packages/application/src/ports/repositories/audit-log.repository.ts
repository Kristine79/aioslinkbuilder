import type { AuditLogEntry } from '@aios/domain';

export interface AuditLogRepository {
  append(entry: AuditLogEntry): Promise<void>;
}
