import { describe, expect, it } from 'vitest';

import { ValidationError } from '@aios/domain';
import {
  CreateCampaignUseCase,
  GetCampaignUseCase,
  ListCampaignsByCompanyUseCase,
  NotFoundError,
  UpdateCampaignUseCase,
} from '@aios/application';

import {
  InMemoryAuditLogRepository,
  InMemoryCampaignRepository,
  InMemoryCompanyRepository,
} from './fakes.js';

describe('CreateCampaignUseCase', () => {
  it('creates a campaign for an existing company and writes an audit event', async () => {
    const companies = new InMemoryCompanyRepository();
    const campaigns = new InMemoryCampaignRepository();
    const auditLog = new InMemoryAuditLogRepository();
    const useCase = new CreateCampaignUseCase(companies, campaigns, auditLog);
    const company = await companies.create({ name: 'Nordhaus' });

    const campaign = await useCase.execute({
      companyId: company.id,
      name: 'Demo Campaign',
      goals: ['Publish on design directories'],
    });

    expect(campaign.id).not.toBe('');
    expect(campaign.status).toBe('DRAFT');
    expect(campaigns.campaigns.get(campaign.id)).toEqual(campaign);
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toEqual({
      actor: 'system',
      action: 'CAMPAIGN_CREATED',
      entityType: 'Campaign',
      entityId: campaign.id,
      metadata: null,
    });
  });

  it('throws NotFoundError when the company does not exist', async () => {
    const useCase = new CreateCampaignUseCase(
      new InMemoryCompanyRepository(),
      new InMemoryCampaignRepository(),
      new InMemoryAuditLogRepository(),
    );

    await expect(
      useCase.execute({ companyId: 'missing', name: 'Demo', goals: [] }),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects an invalid campaign without persisting or auditing', async () => {
    const companies = new InMemoryCompanyRepository();
    const campaigns = new InMemoryCampaignRepository();
    const auditLog = new InMemoryAuditLogRepository();
    const useCase = new CreateCampaignUseCase(companies, campaigns, auditLog);
    const company = await companies.create({ name: 'Nordhaus' });

    await expect(useCase.execute({ companyId: company.id, name: '', goals: [] })).rejects.toThrow(
      ValidationError,
    );
    expect(campaigns.campaigns.size).toBe(0);
    expect(auditLog.entries).toHaveLength(0);
  });
});

describe('UpdateCampaignUseCase', () => {
  it('merges only the provided fields', async () => {
    const companies = new InMemoryCompanyRepository();
    const campaigns = new InMemoryCampaignRepository();
    const useCase = new UpdateCampaignUseCase(campaigns);
    const company = await companies.create({ name: 'Nordhaus' });
    const created = await campaigns.create({
      companyId: company.id,
      name: 'Demo Campaign',
      goals: ['First goal'],
    });

    const updated = await useCase.execute({
      id: created.id,
      fields: { goals: ['First goal', 'Second goal'] },
    });

    expect(updated.name).toBe('Demo Campaign');
    expect(updated.goals).toEqual(['First goal', 'Second goal']);
    expect(updated.companyId).toBe(company.id);
    expect(campaigns.campaigns.get(created.id)).toEqual(updated);
  });

  it('rejects an update that would produce an invalid campaign', async () => {
    const companies = new InMemoryCompanyRepository();
    const campaigns = new InMemoryCampaignRepository();
    const useCase = new UpdateCampaignUseCase(campaigns);
    const company = await companies.create({ name: 'Nordhaus' });
    const created = await campaigns.create({
      companyId: company.id,
      name: 'Demo Campaign',
      goals: ['First goal'],
    });

    await expect(
      useCase.execute({ id: created.id, fields: { goals: ['ok', '  '] } }),
    ).rejects.toThrow(ValidationError);
    expect(campaigns.campaigns.get(created.id)?.goals).toEqual(['First goal']);
  });

  it('throws NotFoundError for a missing campaign', async () => {
    const useCase = new UpdateCampaignUseCase(new InMemoryCampaignRepository());

    await expect(useCase.execute({ id: 'missing', fields: { name: 'X' } })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('GetCampaignUseCase', () => {
  it('returns an existing campaign', async () => {
    const companies = new InMemoryCompanyRepository();
    const campaigns = new InMemoryCampaignRepository();
    const useCase = new GetCampaignUseCase(campaigns);
    const company = await companies.create({ name: 'Nordhaus' });
    const created = await campaigns.create({
      companyId: company.id,
      name: 'Demo Campaign',
      goals: [],
    });

    await expect(useCase.execute(created.id)).resolves.toEqual(created);
  });

  it('throws NotFoundError for a missing campaign', async () => {
    const useCase = new GetCampaignUseCase(new InMemoryCampaignRepository());

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});

describe('ListCampaignsByCompanyUseCase', () => {
  it('returns only campaigns of the given company', async () => {
    const companies = new InMemoryCompanyRepository();
    const campaigns = new InMemoryCampaignRepository();
    const useCase = new ListCampaignsByCompanyUseCase(campaigns);
    const companyA = await companies.create({ name: 'Company A' });
    const companyB = await companies.create({ name: 'Company B' });
    await campaigns.create({ companyId: companyA.id, name: 'Campaign A1', goals: [] });
    await campaigns.create({ companyId: companyA.id, name: 'Campaign A2', goals: [] });
    await campaigns.create({ companyId: companyB.id, name: 'Campaign B1', goals: [] });

    const result = await useCase.execute(companyA.id);

    expect(result.map((campaign) => campaign.name).sort()).toEqual(['Campaign A1', 'Campaign A2']);
  });

  it('returns an empty list for a company without campaigns', async () => {
    const useCase = new ListCampaignsByCompanyUseCase(new InMemoryCampaignRepository());

    await expect(useCase.execute('company-without-campaigns')).resolves.toEqual([]);
  });
});
