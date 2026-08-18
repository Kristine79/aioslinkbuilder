import { EVIDENCE_TYPES } from '../enums/evidence-type.js';
import type { EvidenceType } from '../enums/evidence-type.js';
import { ValidationError } from '../errors.js';

export interface EvidenceDraft {
  verificationId: string;
  type: EvidenceType;
  url: string | null;
  content: string | null;
  metadata: Readonly<Record<string, unknown>> | null;
}

export function validateEvidence(draft: EvidenceDraft): void {
  if (draft.verificationId.trim().length === 0) {
    throw new ValidationError('Evidence verificationId must not be empty');
  }
  if (!EVIDENCE_TYPES.includes(draft.type)) {
    throw new ValidationError(`Evidence type must be one of: ${EVIDENCE_TYPES.join(', ')}`);
  }
  if (draft.url !== null && draft.url.trim().length === 0) {
    throw new ValidationError('Evidence url must not be empty');
  }
  if (draft.content !== null && draft.content.trim().length === 0) {
    throw new ValidationError('Evidence content must not be empty');
  }
}
