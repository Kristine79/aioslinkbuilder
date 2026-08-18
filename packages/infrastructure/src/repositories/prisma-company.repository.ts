import type { PrismaClient, Prisma } from '@prisma/client';
import type { Company, CompanyDraft } from '@aios/domain';
import type { CompanyRepository } from '@aios/application';

import { toDomainMetadata, toPrismaJson } from './mappers.js';

export class PrismaCompanyRepository implements CompanyRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<Company | null> {
    const row = await this.db.company.findUnique({ where: { id } });
    return row === null ? null : toCompany(row);
  }

  async create(draft: CompanyDraft): Promise<Company> {
    const row = await this.db.company.create({ data: { ...draft } });
    return toCompany(row);
  }

  async update(company: Company): Promise<Company> {
    const row = await this.db.company.update({
      where: { id: company.id },
      data: {
        name: company.name,
        description: company.description,
        industry: company.industry,
        geography: company.geography,
        locations: company.locations,
        products: company.products,
        targetAudience: company.targetAudience,
        website: company.website,
        metadata: toPrismaJson(company.metadata),
      },
    });
    return toCompany(row);
  }
}

function toCompany(row: Prisma.CompanyGetPayload<Record<string, never>>): Company {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    industry: row.industry,
    geography: row.geography,
    locations: row.locations,
    products: row.products,
    targetAudience: row.targetAudience,
    website: row.website,
    metadata: toDomainMetadata(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
