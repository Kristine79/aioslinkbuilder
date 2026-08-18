import { PLACEMENT_METHODS } from '../enums/placement-method.js';
import type { PlacementMethod } from '../enums/placement-method.js';
import { PLACEMENT_TYPES } from '../enums/placement-type.js';
import type { PlacementType } from '../enums/placement-type.js';
import { ValidationError } from '../errors.js';

export interface OpportunityDraft {
  campaignId: string;
  platformId: string;
  placementType: PlacementType;
  placementMethod: PlacementMethod;
  categoryId?: string | null;
  /** Discovery-time facts (e.g. which discovery source found the platform). */
  metadata?: Readonly<Record<string, unknown>> | null;
}

export function validateOpportunity(draft: OpportunityDraft): void {
  if (draft.campaignId.trim().length === 0) {
    throw new ValidationError('Opportunity campaignId must not be empty');
  }
  if (draft.platformId.trim().length === 0) {
    throw new ValidationError('Opportunity platformId must not be empty');
  }
  if (
    draft.categoryId !== undefined &&
    draft.categoryId !== null &&
    draft.categoryId.trim().length === 0
  ) {
    throw new ValidationError('Opportunity categoryId must not be empty');
  }
  if (!PLACEMENT_TYPES.includes(draft.placementType)) {
    throw new ValidationError(
      `Opportunity placementType must be one of: ${PLACEMENT_TYPES.join(', ')}`,
    );
  }
  if (!PLACEMENT_METHODS.includes(draft.placementMethod)) {
    throw new ValidationError(
      `Opportunity placementMethod must be one of: ${PLACEMENT_METHODS.join(', ')}`,
    );
  }
}
