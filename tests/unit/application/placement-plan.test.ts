import { describe, expect, it } from 'vitest';

import type { CompanyAnalysis, PlacementPlanDecisionMap } from '@aios/ai';
import {
  GeneratePlacementPlanUseCase,
  GetPlacementPlanUseCase,
  NoPlacementPlanError,
  PlanGenerationFailedError,
} from '@aios/application';

import {
  InMemoryAIAnalysisRepository,
  InMemoryAuditLogRepository,
  InMemoryCampaignRepository,
  InMemoryCompanyRepository,
  InMemoryLookupRepository,
  InMemoryPlacementOpportunityRepository,
  StubAIProvider,
  type StubAIProviderState,
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
  auditLog: InMemoryAuditLogRepository;
  lookups: InMemoryLookupRepository;
  opportunities: InMemoryPlacementOpportunityRepository;
  ai: StubAIProvider;
  campaignId: string;
  opportunityIds: string[];
  generate: GeneratePlacementPlanUseCase;
  get: GetPlacementPlanUseCase;
}

async function createHarness(aiState: StubAIProviderState = {}): Promise<Harness> {
  const companies = new InMemoryCompanyRepository();
  const campaigns = new InMemoryCampaignRepository();
  const analyses = new InMemoryAIAnalysisRepository();
  const auditLog = new InMemoryAuditLogRepository();
  const lookups = new InMemoryLookupRepository();
  const opportunities = new InMemoryPlacementOpportunityRepository();

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
  lookups.platforms = [
    {
      id: 'platform-1',
      name: 'Catalog A',
      url: 'https://catalog-a.example',
      country: 'RU',
      categoryId: 'cat-maps',
      notes: null,
      metadata: null,
    },
    {
      id: 'platform-2',
      name: 'Media B',
      url: 'https://media-b.example',
      country: null,
      categoryId: 'cat-media',
      notes: null,
      metadata: null,
    },
  ];
  lookups.providers = [
    {
      id: 'provider-1',
      platformId: 'platform-1',
      name: 'Catalog A Mock',
      providerType: 'MOCK',
      capabilities: ['DISCOVER', 'VALIDATE', 'CREATE', 'GET_STATUS', 'VERIFY'],
      capabilitiesVerified: true,
      notes: null,
    },
  ];

  const company = await companies.create({ name: 'Nordhaus' });
  const campaign = await campaigns.create({
    companyId: company.id,
    name: 'Demo Campaign',
    goals: ['Grow visibility'],
  });
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

  const strong = await opportunities.create({
    campaignId: campaign.id,
    platformId: 'platform-1',
    categoryId: 'cat-maps',
    placementType: 'BUSINESS_PROFILE',
    placementMethod: 'API',
    metadata: null,
  });
  await opportunities.update({
    ...strong,
    relevance: 'high',
    score: 88,
    providerCapabilities: ['CREATE', 'VERIFY'],
    status: 'QUALIFIED',
    metadata: {
      scoreV2: {
        relevanceScore: 90,
        donorQualityScore: 85,
        placementQualityScore: 80,
        executionScore: 90,
        riskScore: 20,
        overall: 87,
      },
      donorQuality: { overallDonorQuality: 85 },
      riskAssessment: { level: 'LOW' },
    },
  });
  const weak = await opportunities.create({
    campaignId: campaign.id,
    platformId: 'platform-2',
    categoryId: 'cat-media',
    placementType: 'EDITORIAL_PUBLICATION',
    placementMethod: 'OUTREACH',
    metadata: null,
  });
  await opportunities.update({
    ...weak,
    relevance: 'low',
    score: 40,
    providerCapabilities: [],
    status: 'QUALIFIED',
    metadata: {
      scoreV2: {
        relevanceScore: 40,
        donorQualityScore: 45,
        placementQualityScore: 35,
        executionScore: 30,
        riskScore: 70,
        overall: 38,
      },
      donorQuality: { overallDonorQuality: 45 },
      riskAssessment: { level: 'MEDIUM' },
    },
  });

  const ai = new StubAIProvider(aiState);
  const generate = new GeneratePlacementPlanUseCase(
    opportunities,
    campaigns,
    companies,
    analyses,
    lookups,
    ai,
    auditLog,
  );
  const get = new GetPlacementPlanUseCase(opportunities, campaigns, companies, analyses, lookups);

  return {
    companies,
    campaigns,
    analyses,
    auditLog,
    lookups,
    opportunities,
    ai,
    campaignId: campaign.id,
    opportunityIds: [strong.id, weak.id],
    generate,
    get,
  };
}

function decisionMapFor(harness: Harness): PlacementPlanDecisionMap {
  const [strongId, weakId] = harness.opportunityIds;
  if (strongId === undefined || weakId === undefined) {
    throw new Error('harness requires two opportunities');
  }
  return {
    items: [
      {
        opportunityId: strongId,
        recommendation: 'RECOMMENDED',
        recommendationReason: 'High overall score and clean donor profile',
        nextAction: 'EXECUTE_AUTOMATICALLY',
        automationLevel: 'AUTOMATIC',
        riskExplanation: null,
        suggestedPlacementApproach: 'via API',
        anchorRecommendation: null,
      },
      {
        opportunityId: weakId,
        recommendation: 'NOT_RECOMMENDED',
        recommendationReason: 'Low score and weak relevance',
        nextAction: 'REJECT',
        automationLevel: 'HUMAN_REQUIRED',
        riskExplanation: 'Medium risk donor',
        suggestedPlacementApproach: null,
        anchorRecommendation: null,
      },
    ],
    overview: '2 opportunities analyzed',
  };
}

describe('GeneratePlacementPlanUseCase', () => {
  it('generates a reconciled plan and persists it with an audit event', async () => {
    const harness = await createHarness();
    harness.ai.setPlacementPlan(decisionMapFor(harness));
    const plan = await harness.generate.execute({ campaignId: harness.campaignId });

    expect(plan.campaignId).toBe(harness.campaignId);
    expect(plan.items).toHaveLength(2);
    expect(plan.summary.total).toBe(2);
    expect(plan.summary.recommended).toBe(1);
    expect(plan.summary.notRecommended).toBe(1);

    const strong = plan.items.find((item) => item.opportunityId === harness.opportunityIds[0]);
    expect(strong?.decision.recommendation).toBe('RECOMMENDED');
    expect(strong?.decision.nextAction).toBe('EXECUTE_AUTOMATICALLY');
    expect(strong?.decision.automationLevel).toBe('AUTOMATIC');
    // Deterministic scores are preserved in the plan.
    expect(strong?.score).toBe(88);
    expect(strong?.overallScore).toBe(87);

    const weak = plan.items.find((item) => item.opportunityId === harness.opportunityIds[1]);
    expect(weak?.decision.recommendation).toBe('NOT_RECOMMENDED');
    expect(weak?.decision.nextAction).toBe('REJECT');
    expect(weak?.decision.rejectionReason?.kind).toBe('LOW_SCORE');
    expect(weak?.decision.automationLevel).toBe('HUMAN_REQUIRED');

    const stored = await harness.analyses.findLatestValidPlacementPlan(harness.campaignId);
    expect(stored).not.toBeNull();
    expect(stored?.analysisType).toBe('PLACEMENT_PLAN');
    expect(stored?.validationStatus).toBe('VALID');

    const audit = harness.auditLog.entries.filter(
      (entry) => entry.action === 'PLACEMENT_PLAN_GENERATED',
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]?.metadata).toMatchObject({ status: 'COMPLETE', opportunityCount: 2 });
  });

  it('overrides an over-optimistic AI suggestion with the deterministic engine', async () => {
    const harness = await createHarness();
    const decisionMap = decisionMapFor(harness);
    (decisionMap.items as Array<Record<string, unknown>>)[1]!.recommendation = 'RECOMMENDED';
    harness.ai.setPlacementPlan(decisionMap);

    const plan = await harness.generate.execute({ campaignId: harness.campaignId });
    const weak = plan.items.find((item) => item.opportunityId === harness.opportunityIds[1]);
    expect(weak?.decision.recommendation).toBe('NOT_RECOMMENDED');
    expect(weak?.decision.rejectionReason?.kind).toBe('LOW_SCORE');
  });

  it('records a FAILED audit event and throws when the AI provider fails', async () => {
    const harness = await createHarness({
      placementPlanError: new Error('provider down'),
    });

    await expect(harness.generate.execute({ campaignId: harness.campaignId })).rejects.toThrow(
      PlanGenerationFailedError,
    );

    const audit = harness.auditLog.entries.filter(
      (entry) => entry.action === 'PLACEMENT_PLAN_GENERATED',
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]?.metadata).toMatchObject({ status: 'FAILED' });
    // No plan may be fabricated on failure.
    expect(await harness.analyses.findLatestValidPlacementPlan(harness.campaignId)).toBeNull();
  });

  it('rejects malformed AI output (schema validation)', async () => {
    const harness = await createHarness();
    harness.ai.setPlacementPlan({ items: [], overview: 'broken' });

    await expect(harness.generate.execute({ campaignId: harness.campaignId })).rejects.toThrow(
      PlanGenerationFailedError,
    );
  });

  it('rejects a decision map that does not cover all discovered opportunities', async () => {
    const harness = await createHarness();
    const decisionMap = decisionMapFor(harness);
    decisionMap.items.pop();
    harness.ai.setPlacementPlan(decisionMap);

    await expect(harness.generate.execute({ campaignId: harness.campaignId })).rejects.toThrow(
      PlanGenerationFailedError,
    );
  });

  it('rejects a decision map that invents opportunities', async () => {
    const harness = await createHarness();
    const decisionMap = decisionMapFor(harness);
    (decisionMap.items as Array<{ opportunityId: string }>)[1]!.opportunityId = 'invented-id';
    harness.ai.setPlacementPlan(decisionMap);

    await expect(harness.generate.execute({ campaignId: harness.campaignId })).rejects.toThrow(
      PlanGenerationFailedError,
    );
  });
});

describe('GetPlacementPlanUseCase', () => {
  it('returns the stored plan re-reconciled against the current state', async () => {
    const harness = await createHarness();
    harness.ai.setPlacementPlan(decisionMapFor(harness));
    await harness.generate.execute({ campaignId: harness.campaignId });

    const plan = await harness.get.execute({ campaignId: harness.campaignId });
    expect(plan.summary.total).toBe(2);
    expect(plan.items[0]?.decision.recommendation).toBe('RECOMMENDED');
  });

  it('throws NoPlacementPlanError when no plan was generated yet', async () => {
    const harness = await createHarness();
    await expect(harness.get.execute({ campaignId: harness.campaignId })).rejects.toThrow(
      NoPlacementPlanError,
    );
  });

  it('fails when the stored plan is invalid or no longer matches the opportunity set', async () => {
    const harness = await createHarness();
    harness.ai.setPlacementPlan(decisionMapFor(harness));
    await harness.generate.execute({ campaignId: harness.campaignId });

    // A new opportunity is discovered after the plan was generated.
    const extra = await harness.opportunities.create({
      campaignId: harness.campaignId,
      platformId: 'platform-2',
      categoryId: 'cat-media',
      placementType: 'EDITORIAL_PUBLICATION',
      placementMethod: 'OUTREACH',
      metadata: null,
    });
    await harness.opportunities.update({
      ...extra,
      relevance: 'low',
      score: 50,
      status: 'QUALIFIED',
      metadata: null,
    });

    await expect(harness.get.execute({ campaignId: harness.campaignId })).rejects.toThrow(
      PlanGenerationFailedError,
    );
  });
});
