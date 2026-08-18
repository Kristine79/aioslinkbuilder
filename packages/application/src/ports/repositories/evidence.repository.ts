import type { Evidence, EvidenceType } from '@aios/domain';

export interface EvidenceDraft {
  verificationId: string;
  type: EvidenceType;
  url: string | null;
  content: string | null;
  metadata: Readonly<Record<string, unknown>> | null;
}

export interface EvidenceRepository {
  findByVerificationId(verificationId: string): Promise<Evidence[]>;
  create(draft: EvidenceDraft): Promise<Evidence>;
}
