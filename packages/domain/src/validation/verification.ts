import { VERIFICATION_STATUSES } from '../enums/verification-status.js';
import type { VerificationStatus } from '../enums/verification-status.js';
import { ValidationError } from '../errors.js';

export interface VerificationDraft {
  placementId: string;
  status: VerificationStatus;
  checkedAt: Date | null;
  result: Readonly<Record<string, unknown>> | null;
  failureReason: string | null;
}

export function validateVerification(draft: VerificationDraft): void {
  if (draft.placementId.trim().length === 0) {
    throw new ValidationError('Verification placementId must not be empty');
  }
  if (!VERIFICATION_STATUSES.includes(draft.status)) {
    throw new ValidationError(
      `Verification status must be one of: ${VERIFICATION_STATUSES.join(', ')}`,
    );
  }
  if (draft.status === 'PASSED' && draft.checkedAt === null) {
    throw new ValidationError('Passed verification must have a checkedAt timestamp');
  }
  if (draft.failureReason !== null && draft.failureReason.trim().length === 0) {
    throw new ValidationError('Verification failureReason must not be empty');
  }
}
