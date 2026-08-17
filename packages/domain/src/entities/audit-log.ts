export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Readonly<Record<string, unknown>> | null;
}
