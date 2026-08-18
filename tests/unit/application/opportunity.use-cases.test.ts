import { describe, expect, it } from 'vitest';

import { InvalidPlacementTransitionError, ValidationError } from '@aios/domain';
import type { CompanyAnalysis } from '@aios/ai';
import { AIOutputValidationError } from '@aios/ai';
import {
  CatalogPlatformDiscoverySource,
  ClassifyOpportunityUseCase,
  DiscoverOpportunitiesUseCase,
  NoCompanyAnalysisError,
  NotFoundError,
} from '@aios/application';
import type { DiscoverySourceInput, PlatformDiscoverySource } from '@aios/application';
import type { PlacementOpportunity } from '@aios/domain';
import { MockPlacementProvider } from '@aios/integrations';

import {
  InMemoryAIAnalysisRepository,
  InMemoryAuditLogRepository,
  InMemoryCampaignRepository,
  InMemoryCompanyRepository,
  InMemoryLookupRepository,
  InMemoryPlacementOpportunityRepository,
  InMemoryPlacementProviderRegistry,
  StubAIProvider,
  seedCategories,
  seedPlatforms,
  seedProviders,
} from './fakes.js';

const COMPANY_ANALYSIS: CompanyAnalysis = {
  businessType: 'B2B SaaS',
  topics: ['product analytics'],
  audiences: ['product managers'],
  relevantCategories: ['WEB_DIRECTORIES'],
  strategicRecommendations: ['List in web directories'],
};

interface Harness {
  companies: InMemoryCompanyRepository;
  campaigns: InMemoryCampaignRepository;
  lookups: InMemoryLookupRepository;
  opportunities: InMemoryPlacementOpportunityRepository;
  analyses: InMemoryAIAnalysisRepository;
  auditLog: InMemoryAuditLogRepository;
  campaignId: string;
  discover: DiscoverOpportunitiesUseCase;
  classify: ClassifyOpportunityUseCase;
}

async function createHarness(): Promise<Harness> {
  const companies = new InMemoryCompanyRepository();
  const campaigns = new InMemoryCampaignRepository();
  const lookups = new InMemoryLookupRepository();
  const opportunities = new InMemoryPlacementOpportunityRepository();
  const analyses = new InMemoryAIAnalysisRepository();
  const auditLog = new InMemoryAuditLogRepository();

  lookups.categories = seedCategories();
  lookups.platforms = seedPlatforms();
  lookups.providers = seedProviders();

  const registry = new InMemoryPlacementProviderRegistry(
    lookups.providers,
    new Map([
      ['provider-1', new MockPlacementProvider('Mock A', lookups.providers[0]?.capabilities ?? [])],
    ]),
  );

  const company = await companies.create({ name: 'Nordhaus' });
  const campaign = await campaigns.create({
    companyId: company.id,
    name: 'Demo Campaign',
    goals: ['Grow visibility'],
  });

  const discover = new DiscoverOpportunitiesUseCase(
    campaigns,
    companies,
    lookups,
    opportunities,
    auditLog,
    [new CatalogPlatformDiscoverySource(lookups)],
  );

  return {
    companies,
    campaigns,
    lookups,
    opportunities,
    analyses,
    auditLog,
    campaignId: campaign.id,
    discover,
    classify: new ClassifyOpportunityUseCase(
      new StubAIProvider({
        classification: {
          category: 'WEB_DIRECTORIES',
          placementType: 'DIRECTORY_LISTING',
          topicalRelevance: 90,
          audienceMatch: 80,
          geographicRelevance: 70,
          recommendationReason: 'Strong overlap with target audience',
        },
      }),
      opportunities,
      analyses,
      lookups,
      registry,
      auditLog,
    ),
  };
}

async function addCompanyAnalysis(
  harness: Harness,
  status: 'VALID' | 'INVALID' = 'VALID',
): Promise<void> {
  await harness.analyses.create({
    campaignId: harness.campaignId,
    analysisType: 'COMPANY_ANALYSIS',
    provider: 'stub',
    model: null,
    inputReference: null,
    structuredOutput: COMPANY_ANALYSIS,
    schemaVersion: '1',
    validationStatus: status,
  });
}

async function firstDiscovery(harness: Harness): Promise<PlacementOpportunity> {
  const [opportunity] = await harness.discover.execute({
    campaignId: harness.campaignId,
    placementType: 'DIRECTORY_LISTING',
  });
  if (opportunity === undefined) {
    throw new Error('expected at least one discovered opportunity');
  }
  return opportunity;
}

describe('DiscoverOpportunitiesUseCase', () => {
  it('creates DISCOVERED opportunities for all catalog platforms', async () => {
    const harness = await createHarness();

    const discovered = await harness.discover.execute({
      campaignId: harness.campaignId,
      placementType: 'DIRECTORY_LISTING',
    });

    expect(discovered).toHaveLength(2);
    const stored = harness.opportunities.opportunities.get(discovered[0]?.id ?? '');
    expect(stored?.status).toBe('DISCOVERED');
    expect(stored?.placementMethod).toBe('UNKNOWN');
    expect(stored?.placementType).toBe('DIRECTORY_LISTING');
    expect(stored?.score).toBeNull();
    expect(stored?.providerCapabilities).toEqual([]);
    expect(harness.auditLog.entries).toHaveLength(2);
    expect(harness.auditLog.entries[0]).toMatchObject({
      action: 'OPPORTUNITY_DISCOVERED',
      entityType: 'PlacementOpportunity',
    });
  });

  it('does not create duplicates for the same campaign and platform', async () => {
    const harness = await createHarness();
    await harness.discover.execute({
      campaignId: harness.campaignId,
      placementType: 'BACKLINK',
    });

    const secondRun = await harness.discover.execute({
      campaignId: harness.campaignId,
      placementType: 'BACKLINK',
    });

    expect(secondRun).toHaveLength(0);
    expect(harness.opportunities.opportunities.size).toBe(2);
  });

  it('filters platforms by category codes', async () => {
    const harness = await createHarness();

    const discovered = await harness.discover.execute({
      campaignId: harness.campaignId,
      placementType: 'DIRECTORY_LISTING',
      categoryCodes: ['WEB_DIRECTORIES'],
    });

    expect(discovered).toHaveLength(1);
    expect(discovered[0]?.platformId).toBe('platform-1');
  });

  it('throws NotFoundError for an unknown campaign without persisting', async () => {
    const harness = await createHarness();

    await expect(
      harness.discover.execute({ campaignId: 'missing', placementType: 'BACKLINK' }),
    ).rejects.toThrow(NotFoundError);
    expect(harness.opportunities.opportunities.size).toBe(0);
    expect(harness.auditLog.entries).toHaveLength(0);
  });

  it('rejects an invalid placement type', async () => {
    const harness = await createHarness();

    await expect(
      harness.discover.execute({
        campaignId: harness.campaignId,
        placementType: 'NOT_A_TYPE' as never,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects empty category codes', async () => {
    const harness = await createHarness();

    await expect(
      harness.discover.execute({
        campaignId: harness.campaignId,
        placementType: 'BACKLINK',
        categoryCodes: [''],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('passes the real company profile (name and geography) to discovery sources', async () => {
    const companies = new InMemoryCompanyRepository();
    const campaigns = new InMemoryCampaignRepository();
    const lookups = new InMemoryLookupRepository();
    const opportunities = new InMemoryPlacementOpportunityRepository();
    const auditLog = new InMemoryAuditLogRepository();
    lookups.categories = seedCategories();
    lookups.platforms = seedPlatforms();

    const company = await companies.create({
      name: 'Nordhaus',
      geography: ['Moscow', 'Russia'],
    });
    const campaign = await campaigns.create({
      companyId: company.id,
      name: 'Campaign Name Differs From Company',
      goals: ['Grow visibility'],
    });
    const received: DiscoverySourceInput[] = [];
    const spySource: PlatformDiscoverySource = {
      name: 'spy',
      discover: (input) => {
        received.push(input);
        return Promise.resolve({ candidates: [] });
      },
    };
    const discover = new DiscoverOpportunitiesUseCase(
      campaigns,
      companies,
      lookups,
      opportunities,
      auditLog,
      [spySource],
    );

    await discover.execute({ campaignId: campaign.id, placementType: 'BACKLINK' });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      companyName: 'Nordhaus',
      geography: ['Moscow', 'Russia'],
      goals: ['Grow visibility'],
    });
  });
});

describe('ClassifyOpportunityUseCase', () => {
  it('classifies a DISCOVERED opportunity into QUALIFIED with a deterministic score', async () => {
    const harness = await createHarness();
    const opportunity = await firstDiscovery(harness);
    await addCompanyAnalysis(harness);

    const classified = await harness.classify.execute({ opportunityId: opportunity.id });

    expect(classified.status).toBe('QUALIFIED');
    expect(classified.categoryId).toBe('cat-1');
    expect(classified.placementType).toBe('DIRECTORY_LISTING');
    expect(classified.score).toBe(71);
    expect(classified.scoreBreakdown).toMatchObject({
      topicalRelevance: 90,
      audienceMatch: 80,
      geographicRelevance: 70,
      authority: 50,
      placementQuality: 50,
      automationPotential: 50,
    });
    expect(classified.whyRecommended).toContain('Тематическая релевантность 90/100');
  });

  it('throws NotFoundError for a missing opportunity', async () => {
    const harness = await createHarness();

    await expect(harness.classify.execute({ opportunityId: 'missing' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('throws NoCompanyAnalysisError when no valid company analysis exists', async () => {
    const harness = await createHarness();
    const opportunity = await firstDiscovery(harness);

    await expect(harness.classify.execute({ opportunityId: opportunity.id })).rejects.toThrow(
      NoCompanyAnalysisError,
    );
  });

  it('throws NoCompanyAnalysisError when the only company analysis is INVALID', async () => {
    const harness = await createHarness();
    const opportunity = await firstDiscovery(harness);
    await addCompanyAnalysis(harness, 'INVALID');

    await expect(harness.classify.execute({ opportunityId: opportunity.id })).rejects.toThrow(
      NoCompanyAnalysisError,
    );
  });

  it('rejects stored company analysis that no longer conforms to the schema', async () => {
    const harness = await createHarness();
    const opportunity = await firstDiscovery(harness);
    await harness.analyses.create({
      campaignId: harness.campaignId,
      analysisType: 'COMPANY_ANALYSIS',
      provider: 'stub',
      model: null,
      inputReference: null,
      structuredOutput: { businessType: 'broken' },
      schemaVersion: '1',
      validationStatus: 'VALID',
    });

    await expect(harness.classify.execute({ opportunityId: opportunity.id })).rejects.toThrow(
      AIOutputValidationError,
    );
  });

  it('uses deterministic score values from the command', async () => {
    const harness = await createHarness();
    const opportunity = await firstDiscovery(harness);
    await addCompanyAnalysis(harness);

    const classified = await harness.classify.execute({
      opportunityId: opportunity.id,
      deterministicScores: { authority: 100, placementQuality: 0, automationPotential: 50 },
    });

    expect(classified.scoreBreakdown).toMatchObject({
      authority: 100,
      placementQuality: 0,
      automationPotential: 50,
    });
  });

  it('rejects out-of-range deterministic scores', async () => {
    const harness = await createHarness();
    const opportunity = await firstDiscovery(harness);
    await addCompanyAnalysis(harness);

    await expect(
      harness.classify.execute({
        opportunityId: opportunity.id,
        deterministicScores: { authority: 150 },
      }),
    ).rejects.toThrow(ValidationError);
    expect(harness.opportunities.opportunities.get(opportunity.id)?.status).toBe('DISCOVERED');
  });

  it('rejects AI output that fails classification schema validation', async () => {
    const companies = new InMemoryCompanyRepository();
    const campaigns = new InMemoryCampaignRepository();
    const lookups = new InMemoryLookupRepository();
    const opportunities = new InMemoryPlacementOpportunityRepository();
    const analyses = new InMemoryAIAnalysisRepository();
    const auditLog = new InMemoryAuditLogRepository();
    lookups.categories = seedCategories();
    lookups.platforms = seedPlatforms();
    const company = await companies.create({ name: 'Nordhaus' });
    const campaign = await campaigns.create({
      companyId: company.id,
      name: 'Demo',
      goals: [],
    });
    const discover = new DiscoverOpportunitiesUseCase(
      campaigns,
      companies,
      lookups,
      opportunities,
      auditLog,
      [new CatalogPlatformDiscoverySource(lookups)],
    );
    const [opportunity] = await discover.execute({
      campaignId: campaign.id,
      placementType: 'BACKLINK',
    });
    if (opportunity === undefined) {
      throw new Error('expected a discovered opportunity');
    }
    await analyses.create({
      campaignId: campaign.id,
      analysisType: 'COMPANY_ANALYSIS',
      provider: 'stub',
      model: null,
      inputReference: null,
      structuredOutput: COMPANY_ANALYSIS,
      schemaVersion: '1',
      validationStatus: 'VALID',
    });
    const classify = new ClassifyOpportunityUseCase(
      new StubAIProvider({
        classification: {
          category: 'WEB_DIRECTORIES',
          placementType: 'BACKLINK',
          topicalRelevance: 500,
          audienceMatch: 80,
          geographicRelevance: 70,
          recommendationReason: 'Broken output',
        },
      }),
      opportunities,
      analyses,
      lookups,
      new InMemoryPlacementProviderRegistry(seedProviders()),
      auditLog,
    );

    await expect(classify.execute({ opportunityId: opportunity.id })).rejects.toThrow(
      AIOutputValidationError,
    );
    expect(opportunities.opportunities.get(opportunity.id)?.status).toBe('DISCOVERED');
  });

  it('stores a VALID classification analysis and an audit event', async () => {
    const harness = await createHarness();
    const opportunity = await firstDiscovery(harness);
    await addCompanyAnalysis(harness);

    await harness.classify.execute({ opportunityId: opportunity.id });

    const classification = [...harness.analyses.analyses.values()].find(
      (analysis) => analysis.analysisType === 'OPPORTUNITY_CLASSIFICATION',
    );
    expect(classification).toBeDefined();
    expect(classification?.validationStatus).toBe('VALID');
    expect(classification?.provider).toBe('stub');
    expect(classification?.structuredOutput).toMatchObject({ placementType: 'DIRECTORY_LISTING' });
    const lastEntry = harness.auditLog.entries[harness.auditLog.entries.length - 1];
    expect(lastEntry).toMatchObject({
      action: 'OPPORTUNITY_CLASSIFIED',
      entityId: opportunity.id,
    });
  });

  it('rejects classification of an opportunity that is not DISCOVERED', async () => {
    const harness = await createHarness();
    const opportunity = await firstDiscovery(harness);
    await addCompanyAnalysis(harness);
    const qualified = await harness.classify.execute({ opportunityId: opportunity.id });

    await expect(harness.classify.execute({ opportunityId: qualified.id })).rejects.toThrow(
      InvalidPlacementTransitionError,
    );
  });

  it('keeps the platform page metadata in the classification input', async () => {
    const harness = await createHarness();
    const opportunity = await firstDiscovery(harness);
    const stored = harness.opportunities.opportunities.get(opportunity.id);
    if (stored === undefined) {
      throw new Error('opportunity not stored');
    }
    await harness.opportunities.update({
      ...stored,
      metadata: { page: '/en' },
      updatedAt: new Date(),
    });
    await addCompanyAnalysis(harness);

    await harness.classify.execute({ opportunityId: opportunity.id });

    const classification = [...harness.analyses.analyses.values()].find(
      (analysis) => analysis.analysisType === 'OPPORTUNITY_CLASSIFICATION',
    );
    expect(classification?.inputReference).toMatchObject({ platformId: 'platform-1' });
  });
});
