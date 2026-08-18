import type { Company, CompanyDraft } from '@aios/domain';
import type { CompanyRepository } from '@aios/application';

import { randomUUID } from 'node:crypto';

/**
 * In-memory implementation of CompanyRepository. Used by the prototype demo,
 * the API composition and tests; the Prisma repositories remain the
 * production path.
 */
export class InMemoryCompanyRepository implements CompanyRepository {
  readonly companies = new Map<string, Company>();

  findById(id: string): Promise<Company | null> {
    return Promise.resolve(this.companies.get(id) ?? null);
  }

  create(draft: CompanyDraft): Promise<Company> {
    const now = new Date();
    const company: Company = {
      id: randomUUID(),
      name: draft.name,
      description: draft.description ?? null,
      industry: draft.industry ?? null,
      geography: draft.geography ?? [],
      locations: draft.locations ?? [],
      products: draft.products ?? [],
      targetAudience: draft.targetAudience ?? [],
      website: draft.website ?? null,
      metadata: null,
      createdAt: now,
      updatedAt: now,
    };
    this.companies.set(company.id, company);
    return Promise.resolve(company);
  }

  update(company: Company): Promise<Company> {
    this.companies.set(company.id, company);
    return Promise.resolve(company);
  }
}
