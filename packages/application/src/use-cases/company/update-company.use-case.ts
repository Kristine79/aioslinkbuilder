import type { Company } from '@aios/domain';
import { validateCompany } from '@aios/domain';

import type { UpdateCompanyCommand } from '../../dtos/company-commands.js';
import { NotFoundError } from '../../errors.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';

export class UpdateCompanyUseCase {
  constructor(private readonly companies: CompanyRepository) {}

  async execute(command: UpdateCompanyCommand): Promise<Company> {
    const existing = await this.companies.findById(command.id);
    if (existing === null) {
      throw new NotFoundError('Company', command.id);
    }
    const fields = command.fields;
    const updated: Company = {
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
      name: fields.name ?? existing.name,
      description: fields.description !== undefined ? fields.description : existing.description,
      industry: fields.industry !== undefined ? fields.industry : existing.industry,
      geography: fields.geography ?? existing.geography,
      locations: fields.locations ?? existing.locations,
      products: fields.products ?? existing.products,
      targetAudience: fields.targetAudience ?? existing.targetAudience,
      website: fields.website !== undefined ? fields.website : existing.website,
      metadata: existing.metadata,
    };
    validateCompany(updated);
    return this.companies.update(updated);
  }
}
