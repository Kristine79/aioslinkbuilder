import type { Company } from '@aios/domain';

import { NotFoundError } from '../../errors.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';

export class GetCompanyUseCase {
  constructor(private readonly companies: CompanyRepository) {}

  async execute(id: string): Promise<Company> {
    const company = await this.companies.findById(id);
    if (company === null) {
      throw new NotFoundError('Company', id);
    }
    return company;
  }
}
