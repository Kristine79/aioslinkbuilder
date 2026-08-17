export const VERIFICATION_STATUSES = ['PENDING', 'PASSED', 'FAILED'] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
