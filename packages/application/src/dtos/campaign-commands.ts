export interface CreateCampaignCommand {
  companyId: string;
  name: string;
  goals: string[];
}

export interface UpdateCampaignCommand {
  id: string;
  fields: UpdateCampaignFields;
}

export interface UpdateCampaignFields {
  name?: string;
  goals?: string[];
}
