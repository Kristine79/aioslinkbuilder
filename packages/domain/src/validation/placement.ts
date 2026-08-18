import { ValidationError } from '../errors.js';
import type { PlacementStatus } from '../enums/placement-status.js';

export interface PlacementDraft {
  opportunityId: string;
  providerId: string | null;
  /** Initial status of the placement record. Defaults to READY (automatic
   * execution); manual execution starts at NEEDS_MANUAL. */
  status?: PlacementStatus;
}

const ALLOWED_INITIAL_STATUSES: readonly PlacementStatus[] = ['READY', 'NEEDS_MANUAL'];

export function validatePlacement(draft: PlacementDraft): void {
  if (draft.opportunityId.trim().length === 0) {
    throw new ValidationError('Placement opportunityId must not be empty');
  }
  if (draft.providerId !== null && draft.providerId.trim().length === 0) {
    throw new ValidationError('Placement providerId must not be empty');
  }
  if (draft.status !== undefined && !ALLOWED_INITIAL_STATUSES.includes(draft.status)) {
    throw new ValidationError(`Placement cannot be created with status ${draft.status}`);
  }
}

export interface ManualPlacementRequestDraft {
  reason: string;
}

export interface ManualPlacementCompletionDraft {
  externalId: string;
  liveUrl: string;
}

export function validateManualPlacementRequest(draft: ManualPlacementRequestDraft): void {
  if (draft.reason.trim().length === 0) {
    throw new ValidationError('Manual placement reason must not be empty');
  }
}

export function validateManualPlacementCompletion(draft: ManualPlacementCompletionDraft): void {
  if (draft.externalId.trim().length === 0) {
    throw new ValidationError('Manual placement externalId must not be empty');
  }
  if (draft.liveUrl.trim().length === 0) {
    throw new ValidationError('Manual placement liveUrl must not be empty');
  }
}
