export const CAMPAIGN_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED'] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
