import { describe, expect, it } from 'vitest';

import { ValidationError, validateCampaign } from '@aios/domain';
import type { CampaignDraft } from '@aios/domain';

describe('campaign validation', () => {
  const validCampaign: CampaignDraft = {
    companyId: 'company-1',
    name: 'Nordhaus Demo Campaign',
    goals: ['Publish the brand on design directories'],
  };

  it('accepts a valid campaign', () => {
    expect(() => validateCampaign(validCampaign)).not.toThrow();
  });

  it('accepts a campaign without goals', () => {
    expect(() => validateCampaign({ ...validCampaign, goals: [] })).not.toThrow();
  });

  it('rejects an empty campaign name', () => {
    expect(() => validateCampaign({ ...validCampaign, name: '   ' })).toThrow(ValidationError);
  });

  it('rejects an empty companyId', () => {
    expect(() => validateCampaign({ ...validCampaign, companyId: '' })).toThrow(ValidationError);
  });

  it('rejects empty goal entries', () => {
    expect(() => validateCampaign({ ...validCampaign, goals: ['valid goal', '   '] })).toThrow(
      ValidationError,
    );
  });
});
