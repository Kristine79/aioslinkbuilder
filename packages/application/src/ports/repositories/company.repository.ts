import type { Company } from '@aios/domain';

export interface CompanyRepository {
  findById(id: string): Promise<Company | null>;
  save(company: Company): Promise<Company>;
}
