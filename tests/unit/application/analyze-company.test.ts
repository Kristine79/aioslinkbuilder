import { describe, expect, it } from 'vitest';

import type { CompanyAnalysis } from '@aios/ai';
import { AIOutputValidationError } from '@aios/ai';
import { AnalyzeCompanyUseCase, NotFoundError } from '@aios/application';

import {
  InMemoryAIAnalysisRepository,
  InMemoryAuditLogRepository,
  InMemoryCampaignRepository,
  InMemoryCompanyRepository,
  StubAIProvider,
} from './fakes.js';

const COMPANY_ANALYSIS: CompanyAnalysis = {
  businessType: 'Premium furniture manufacturer',
  topics: ['made-to-order kitchens', 'interior design'],
  audiences: ['interior designers', 'premium property owners'],
  relevantCategories: ['maps-local', 'interior-design'],
  strategicRecommendations: ['List on local maps', 'Publish on interior portals'],
};

interface Harness {
  companies: InMemoryCompanyRepository;
  campaigns: InMemoryCampaignRepository;
  analyses: InMemoryAIAnalysisRepository;
  auditLog: InMemoryAuditLogRepository;
  aiProvider: StubAIProvider;
  analyze: AnalyzeCompanyUseCase;
  campaignId: string;
  companyId: string;
}

async function createHarness(): Promise<Harness> {
  const companies = new InMemoryCompanyRepository();
  const campaigns = new InMemoryCampaignRepository();
  const analyses = new InMemoryAIAnalysisRepository();
  const auditLog = new InMemoryAuditLogRepository();
  const aiProvider = new StubAIProvider({ companyAnalysis: COMPANY_ANALYSIS });

  const company = await companies.create({
    name: 'Nordhaus',
    description: 'Premium made-to-order furniture',
    industry: 'furniture',
    geography: ['Moscow'],
    locations: ['Moscow'],
    products: ['kitchens', 'wardrobes'],
    targetAudience: ['interior designers'],
    website: 'https://nordhaus.example.com',
  });
  const campaign = await campaigns.create({
    companyId: company.id,
    name: 'Demo Campaign',
    goals: ['Grow visibility among interior designers'],
  });

  const analyze = new AnalyzeCompanyUseCase(campaigns, companies, aiProvider, analyses, auditLog);

  return {
    companies,
    campaigns,
    analyses,
    auditLog,
    aiProvider,
    analyze,
    campaignId: campaign.id,
    companyId: company.id,
  };
}

describe('AnalyzeCompanyUseCase', () => {
  it('stores a VALID company analysis and an audit event', async () => {
    const harness = await createHarness();

    const result = await harness.analyze.execute({ campaignId: harness.campaignId });

    expect(result.businessType).toBe('Premium furniture manufacturer');
    const stored = [...harness.analyses.analyses.values()].find(
      (analysis) => analysis.analysisType === 'COMPANY_ANALYSIS',
    );
    expect(stored).toBeDefined();
    expect(stored?.validationStatus).toBe('VALID');
    expect(stored?.provider).toBe('stub');
    expect(stored?.schemaVersion).toBe('1');
    expect(stored?.structuredOutput).toMatchObject({ businessType: result.businessType });
    expect(harness.auditLog.entries).toHaveLength(1);
    expect(harness.auditLog.entries[0]).toMatchObject({
      action: 'COMPANY_ANALYZED',
      entityType: 'Campaign',
      entityId: harness.campaignId,
    });
  });

  it('passes company profile and campaign goals to the AI provider', async () => {
    const harness = await createHarness();

    await harness.analyze.execute({ campaignId: harness.campaignId });

    expect(harness.aiProvider.lastAnalyzeCompanyInput).toMatchObject({
      companyName: 'Nordhaus',
      industry: 'furniture',
      geography: ['Moscow'],
      products: ['kitchens', 'wardrobes'],
      campaignGoals: ['Grow visibility among interior designers'],
    });
  });

  it('throws NotFoundError for an unknown campaign without persisting', async () => {
    const harness = await createHarness();

    await expect(harness.analyze.execute({ campaignId: 'missing' })).rejects.toThrow(NotFoundError);
    expect(harness.analyses.analyses.size).toBe(0);
    expect(harness.auditLog.entries).toHaveLength(0);
  });

  it('throws NotFoundError when the campaign company is missing', async () => {
    const harness = await createHarness();
    const orphan = await harness.campaigns.create({
      companyId: 'missing-company',
      name: 'Orphan',
      goals: [],
    });

    await expect(harness.analyze.execute({ campaignId: orphan.id })).rejects.toThrow(NotFoundError);
    expect(harness.analyses.analyses.size).toBe(0);
  });

  it('rejects AI output that fails schema validation without storing it', async () => {
    const companies = new InMemoryCompanyRepository();
    const campaigns = new InMemoryCampaignRepository();
    const analyses = new InMemoryAIAnalysisRepository();
    const auditLog = new InMemoryAuditLogRepository();
    const company = await companies.create({ name: 'Nordhaus' });
    const campaign = await campaigns.create({ companyId: company.id, name: 'Demo', goals: [] });
    const analyze = new AnalyzeCompanyUseCase(
      campaigns,
      companies,
      new StubAIProvider({ companyAnalysis: { businessType: 'broken' } as CompanyAnalysis }),
      analyses,
      auditLog,
    );

    await expect(analyze.execute({ campaignId: campaign.id })).rejects.toThrow(
      AIOutputValidationError,
    );
    expect(analyses.analyses.size).toBe(0);
    expect(auditLog.entries).toHaveLength(0);
  });
});
