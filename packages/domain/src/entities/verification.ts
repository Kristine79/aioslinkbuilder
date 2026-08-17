import type { VerificationStatus } from '../enums/verification-status.js';

export interface Verification {
  id: string;
  placementId: string;
  status: VerificationStatus;
  checkedAt: Date | null;
  result: Readonly<Record<string, unknown>> | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
