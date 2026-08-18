import type { CompanyDraft } from '@aios/domain';

export type CreateCompanyCommand = CompanyDraft;

export interface UpdateCompanyCommand {
  id: string;
  fields: UpdateCompanyFields;
}

export interface UpdateCompanyFields {
  name?: string;
  description?: string | null;
  industry?: string | null;
  geography?: string[];
  locations?: string[];
  products?: string[];
  targetAudience?: string[];
  website?: string | null;
}
