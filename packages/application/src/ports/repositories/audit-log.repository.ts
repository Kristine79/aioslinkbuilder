export interface AuditLogDraft {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Readonly<Record<string, unknown>> | null;
}

export interface AuditLogRepository {
  append(draft: AuditLogDraft): Promise<void>;
}
