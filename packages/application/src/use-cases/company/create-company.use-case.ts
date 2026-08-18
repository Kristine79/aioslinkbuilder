import type { Company } from '@aios/domain';
import { validateCompany } from '@aios/domain';

import type { CreateCompanyCommand } from '../../dtos/company-commands.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';

export class CreateCompanyUseCase {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: CreateCompanyCommand): Promise<Company> {
    validateCompany(command);
    const company = await this.companies.create(command);
    await this.auditLog.append({
      actor: 'system',
      action: 'COMPANY_CREATED',
      entityType: 'Company',
      entityId: company.id,
      metadata: null,
    });
    return company;
  }
}
