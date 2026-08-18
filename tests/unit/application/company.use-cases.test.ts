import { describe, expect, it } from 'vitest';

import { ValidationError } from '@aios/domain';
import {
  CreateCompanyUseCase,
  GetCompanyUseCase,
  NotFoundError,
  UpdateCompanyUseCase,
} from '@aios/application';

import { InMemoryAuditLogRepository, InMemoryCompanyRepository } from './fakes.js';

describe('CreateCompanyUseCase', () => {
  it('creates a company and writes an audit event', async () => {
    const companies = new InMemoryCompanyRepository();
    const auditLog = new InMemoryAuditLogRepository();
    const useCase = new CreateCompanyUseCase(companies, auditLog);

    const company = await useCase.execute({
      name: 'Nordhaus',
      website: 'https://nordhaus.example.com',
    });

    expect(company.id).not.toBe('');
    expect(companies.companies.get(company.id)).toEqual(company);
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toEqual({
      actor: 'system',
      action: 'COMPANY_CREATED',
      entityType: 'Company',
      entityId: company.id,
      metadata: null,
    });
  });

  it('rejects an invalid company without persisting or auditing', async () => {
    const companies = new InMemoryCompanyRepository();
    const auditLog = new InMemoryAuditLogRepository();
    const useCase = new CreateCompanyUseCase(companies, auditLog);

    await expect(useCase.execute({ name: '  ' })).rejects.toThrow(ValidationError);
    expect(companies.companies.size).toBe(0);
    expect(auditLog.entries).toHaveLength(0);
  });
});

describe('GetCompanyUseCase', () => {
  it('returns an existing company', async () => {
    const companies = new InMemoryCompanyRepository();
    const useCase = new GetCompanyUseCase(companies);
    const created = await companies.create({ name: 'Nordhaus' });

    await expect(useCase.execute(created.id)).resolves.toEqual(created);
  });

  it('throws NotFoundError for a missing company', async () => {
    const useCase = new GetCompanyUseCase(new InMemoryCompanyRepository());

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});

describe('UpdateCompanyUseCase', () => {
  it('merges only the provided fields', async () => {
    const companies = new InMemoryCompanyRepository();
    const useCase = new UpdateCompanyUseCase(companies);
    const created = await companies.create({
      name: 'Nordhaus',
      description: 'old description',
      products: ['kitchens'],
    });

    const updated = await useCase.execute({
      id: created.id,
      fields: { name: 'Nordhaus Furniture', products: ['kitchens', 'wardrobes'] },
    });

    expect(updated.name).toBe('Nordhaus Furniture');
    expect(updated.description).toBe('old description');
    expect(updated.products).toEqual(['kitchens', 'wardrobes']);
    expect(updated.id).toBe(created.id);
    expect(companies.companies.get(created.id)).toEqual(updated);
  });

  it('clears a field with an explicit null', async () => {
    const companies = new InMemoryCompanyRepository();
    const useCase = new UpdateCompanyUseCase(companies);
    const created = await companies.create({
      name: 'Nordhaus',
      website: 'https://nordhaus.example.com',
    });

    const updated = await useCase.execute({ id: created.id, fields: { website: null } });

    expect(updated.website).toBeNull();
  });

  it('rejects an update that would produce an invalid company', async () => {
    const companies = new InMemoryCompanyRepository();
    const useCase = new UpdateCompanyUseCase(companies);
    const created = await companies.create({ name: 'Nordhaus' });

    await expect(
      useCase.execute({ id: created.id, fields: { website: 'not-a-url' } }),
    ).rejects.toThrow(ValidationError);
    expect(companies.companies.get(created.id)?.website).toBeNull();
  });

  it('throws NotFoundError for a missing company', async () => {
    const useCase = new UpdateCompanyUseCase(new InMemoryCompanyRepository());

    await expect(useCase.execute({ id: 'missing', fields: { name: 'X' } })).rejects.toThrow(
      NotFoundError,
    );
  });
});
