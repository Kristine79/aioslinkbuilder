import type { Company, CompanyDraft } from '@aios/domain';

export interface CompanyRepository {
  findById(id: string): Promise<Company | null>;
  /** All companies, newest first. Used by the delivery layer listings. */
  all(): Promise<Company[]>;
  create(draft: CompanyDraft): Promise<Company>;
  update(company: Company): Promise<Company>;
}
