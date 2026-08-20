import { describe, expect, it } from 'vitest';

import type { CompanyAnalysis } from '@aios/ai';
import {
  GeneratePlacementStrategyUseCase,
  NoCompanyAnalysisError,
  NotFoundError,
} from '@aios/application';

import {
  InMemoryAIAnalysisRepository,
  InMemoryCampaignRepository,
  InMemoryCompanyRepository,
  InMemoryLookupRepository,
} from './fakes.js';

const COMPANY_ANALYSIS: CompanyAnalysis = {
  businessType: 'Premium furniture manufacturer',
  topics: ['interior design'],
  audiences: ['interior designers'],
  relevantCategories: ['maps-local', 'media-pr'],
  strategicRecommendations: ['List on local maps', 'Pitch industry media'],
};

interface Harness {
  companies: InMemoryCompanyRepository;
  campaigns: InMemoryCampaignRepository;
  analyses: InMemoryAIAnalysisRepository;
  lookups: InMemoryLookupRepository;
  strategy: GeneratePlacementStrategyUseCase;
  campaignId: string;
}

async function createHarness(): Promise<Harness> {
  const companies = new InMemoryCompanyRepository();
  const campaigns = new InMemoryCampaignRepository();
  const analyses = new InMemoryAIAnalysisRepository();
  const lookups = new InMemoryLookupRepository();
  lookups.categories = [
    {
      id: 'cat-maps',
      code: 'maps-local',
      name: 'Maps & local directories',
      description: null,
      sortOrder: 1,
    },
    {
      id: 'cat-media',
      code: 'media-pr',
      name: 'Media & PR',
      description: null,
      sortOrder: 2,
    },
  ];

  const company = await companies.create({ name: 'Nordhaus' });
  const campaign = await campaigns.create({
    companyId: company.id,
    name: 'Demo Campaign',
    goals: ['Grow visibility'],
  });

  const strategy = new GeneratePlacementStrategyUseCase(campaigns, companies, analyses, lookups);

  return {
    companies,
    campaigns,
    analyses,
    lookups,
    strategy,
    campaignId: campaign.id,
  };
}

describe('GeneratePlacementStrategyUseCase', () => {
  it('maps relevant categories from the analysis to a deterministic strategy', async () => {
    const harness = await createHarness();
    await harness.analyses.create({
      campaignId: harness.campaignId,
      analysisType: 'COMPANY_ANALYSIS',
      provider: 'stub',
      model: null,
      inputReference: null,
      structuredOutput: COMPANY_ANALYSIS,
      schemaVersion: '1',
      validationStatus: 'VALID',
    });

    const strategy = await harness.strategy.execute({ campaignId: harness.campaignId });

    expect(strategy.campaignId).toBe(harness.campaignId);
    expect(strategy.items).toHaveLength(2);
    expect(strategy.items.map((item) => item.categoryCode)).toEqual(['maps-local', 'media-pr']);
    expect(strategy.items[0]).toMatchObject({
      categoryId: 'cat-maps',
      categoryName: 'Maps & local directories',
      placementType: 'BUSINESS_PROFILE',
    });
    expect(strategy.items[1]).toMatchObject({
      categoryId: 'cat-media',
      placementType: 'EDITORIAL_PUBLICATION',
    });
    expect(strategy.recommendations).toEqual(['List on local maps', 'Pitch industry media']);
  });

  it('keeps AI-derived directions when no analysis category is in the catalog', async () => {
    const harness = await createHarness();
    await harness.analyses.create({
      campaignId: harness.campaignId,
      analysisType: 'COMPANY_ANALYSIS',
      provider: 'stub',
      model: null,
      inputReference: null,
      structuredOutput: {
        ...COMPANY_ANALYSIS,
        relevantCategories: ['NOT_IN_CATALOG'],
      },
      schemaVersion: '1',
      validationStatus: 'VALID',
    });

    const strategy = await harness.strategy.execute({ campaignId: harness.campaignId });

    // The direction stays active even though the catalog has no category for
    // it — the catalog must not erase strategy directions.
    expect(strategy.items).toHaveLength(1);
    expect(strategy.items[0]).toMatchObject({
      categoryId: null,
      categoryCode: 'NOT_IN_CATALOG',
      categoryName: 'NOT_IN_CATALOG',
      placementType: 'DIRECTORY_LISTING',
    });
  });

  it('combines catalog-backed and AI-derived directions', async () => {
    const harness = await createHarness();
    await harness.analyses.create({
      campaignId: harness.campaignId,
      analysisType: 'COMPANY_ANALYSIS',
      provider: 'stub',
      model: null,
      inputReference: null,
      structuredOutput: {
        ...COMPANY_ANALYSIS,
        relevantCategories: ['maps-local', 'custom-topic'],
      },
      schemaVersion: '1',
      validationStatus: 'VALID',
    });

    const strategy = await harness.strategy.execute({ campaignId: harness.campaignId });

    expect(strategy.items).toHaveLength(2);
    expect(strategy.items[0]).toMatchObject({
      categoryId: 'cat-maps',
      categoryCode: 'maps-local',
      placementType: 'BUSINESS_PROFILE',
    });
    expect(strategy.items[1]).toMatchObject({
      categoryId: null,
      categoryCode: 'custom-topic',
      placementType: 'DIRECTORY_LISTING',
    });
  });

  it('throws NotFoundError for an unknown campaign', async () => {
    const harness = await createHarness();

    await expect(harness.strategy.execute({ campaignId: 'missing' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('throws NoCompanyAnalysisError when no valid company analysis exists', async () => {
    const harness = await createHarness();

    await expect(harness.strategy.execute({ campaignId: harness.campaignId })).rejects.toThrow(
      NoCompanyAnalysisError,
    );
  });

  it('ignores INVALID company analyses when generating the strategy', async () => {
    const harness = await createHarness();
    await harness.analyses.create({
      campaignId: harness.campaignId,
      analysisType: 'COMPANY_ANALYSIS',
      provider: 'stub',
      model: null,
      inputReference: null,
      structuredOutput: COMPANY_ANALYSIS,
      schemaVersion: '1',
      validationStatus: 'INVALID',
    });

    await expect(harness.strategy.execute({ campaignId: harness.campaignId })).rejects.toThrow(
      NoCompanyAnalysisError,
    );
  });
});
