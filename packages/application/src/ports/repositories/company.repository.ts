import type { Company, CompanyDraft } from '@aios/domain';

export interface CompanyRepository {
  findById(id: string): Promise<Company | null>;
  create(draft: CompanyDraft): Promise<Company>;
  update(company: Company): Promise<Company>;
}
