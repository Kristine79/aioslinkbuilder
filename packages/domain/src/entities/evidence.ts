import type { EvidenceType } from '../enums/evidence-type.js';

export interface Evidence {
  id: string;
  verificationId: string;
  type: EvidenceType;
  url: string | null;
  content: string | null;
  metadata: Readonly<Record<string, unknown>> | null;
  createdAt: Date;
}
