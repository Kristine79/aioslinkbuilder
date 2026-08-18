import { ValidationError } from '../errors.js';

export interface CampaignDraft {
  companyId: string;
  name: string;
  goals: string[];
}

export function validateCampaign(draft: CampaignDraft): void {
  if (draft.companyId.trim().length === 0) {
    throw new ValidationError('Campaign companyId must not be empty');
  }
  if (draft.name.trim().length === 0) {
    throw new ValidationError('Campaign name must not be empty');
  }
  if (draft.goals.some((goal) => goal.trim().length === 0)) {
    throw new ValidationError('Campaign goals must not be empty');
  }
}
