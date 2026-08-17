import type { CampaignStatus } from '../enums/campaign-status.js';

export interface Campaign {
  id: string;
  companyId: string;
  name: string;
  goals: string[];
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
}
