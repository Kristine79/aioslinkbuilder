import { describe, expect, it } from 'vitest';

import { InvalidPlacementTransitionError, ValidationError } from '@aios/domain';
import type { CompanyAnalysis, OpportunityClassification } from '@aios/ai';
import {
  ApproveOpportunityUseCase,
  CatalogPlatformDiscoverySource,
  ClassifyOpportunityUseCase,
  CompleteManualPlacementUseCase,
  DiscoverOpportunitiesUseCase,
  ExecutePlacementUseCase,
  MonitorPlacementUseCase,
  NoProviderAvailableError,
  NotFoundError,
  RequestManualPlacementUseCase,
  VerifyPlacementUseCase,
} from '@aios/application';
import type { PlacementOpportunity } from '@aios/domain';
import { MockPlacementProvider, ProviderError } from '@aios/integrations';
import type { MockPlacementProviderOptions } from '@aios/integrations';

import {
  InMemoryAIAnalysisRepository,
  InMemoryAuditLogRepository,
  InMemoryCampaignRepository,
  InMemoryCompanyRepository,
  InMemoryEvidenceRepository,
  InMemoryLookupRepository,
  InMemoryPlacementOpportunityRepository,
  InMemoryPlacementProviderRegistry,
  InMemoryPlacementRepository,
  InMemoryVerificationRepository,
  StubAIProvider,
  seedCategories,
  seedPlatforms,
  seedProviders,
} from './fakes.js';

const COMPANY_ANALYSIS: CompanyAnalysis = {
  businessType: 'Premium furniture manufacturer',
  topics: ['interior design'],
  audiences: ['interior designers'],
  relevantCategories: ['WEB_DIRECTORIES'],
  strategicRecommendations: ['List in web directories'],
};

const CLASSIFICATION: OpportunityClassification = {
  category: 'WEB_DIRECTORIES',
  placementType: 'DIRECTORY_LISTING',
  topicalRelevance: 90,
  audienceMatch: 80,
  geographicRelevance: 70,
  recommendationReason: 'Strong overlap with target audience',
};

interface Harness {
  opportunities: InMemoryPlacementOpportunityRepository;
  placements: InMemoryPlacementRepository;
  verifications: InMemoryVerificationRepository;
  evidence: InMemoryEvidenceRepository;
  auditLog: InMemoryAuditLogRepository;
  campaignId: string;
  classifiedOpportunityId: string;
  classifiedManualOpportunityId: string;
  approve: ApproveOpportunityUseCase;
  execute: ExecutePlacementUseCase;
  monitor: MonitorPlacementUseCase;
  verify: VerifyPlacementUseCase;
  requestManual: RequestManualPlacementUseCase;
  completeManual: CompleteManualPlacementUseCase;
}

async function createHarness(
  options: { provider1?: MockPlacementProviderOptions } = {},
): Promise<Harness> {
  const companies = new InMemoryCompanyRepository();
  const campaigns = new InMemoryCampaignRepository();
  const lookups = new InMemoryLookupRepository();
  const opportunities = new InMemoryPlacementOpportunityRepository();
  const placements = new InMemoryPlacementRepository();
  const verifications = new InMemoryVerificationRepository();
  const evidence = new InMemoryEvidenceRepository();
  const analyses = new InMemoryAIAnalysisRepository();
  const auditLog = new InMemoryAuditLogRepository();

  lookups.categories = seedCategories();
  lookups.platforms = seedPlatforms();
  lookups.providers = seedProviders();

  const registry = new InMemoryPlacementProviderRegistry(
    lookups.providers,
    new Map([
      [
        'provider-1',
        new MockPlacementProvider(
          'Provider 1 Mock',
          lookups.providers[0]?.capabilities ?? [],
          options.provider1,
        ),
      ],
      [
        'provider-2',
        new MockPlacementProvider('Provider 2 Manual', lookups.providers[1]?.capabilities ?? []),
      ],
    ]),
  );

  const company = await companies.create({
    name: 'Nordhaus',
    description: 'Premium made-to-order furniture',
    website: 'https://nordhaus.example.com',
    products: ['kitchens'],
    geography: ['Moscow', 'Russia'],
  });
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
  const classify = new ClassifyOpportunityUseCase(
    new StubAIProvider({ classification: CLASSIFICATION }),
    opportunities,
    analyses,
    lookups,
    registry,
    auditLog,
  );

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
  const discovered = await discover.execute({
    campaignId: campaign.id,
    placementType: 'DIRECTORY_LISTING',
  });
  const executable = discovered.find((opportunity) => opportunity.platformId === 'platform-1');
  if (executable === undefined) {
    throw new Error('expected a platform-1 opportunity');
  }
  const manual = discovered.find((opportunity) => opportunity.platformId === 'platform-2');
  if (manual === undefined) {
    throw new Error('expected a platform-2 opportunity');
  }
  const classified = await classify.execute({ opportunityId: executable.id });
  const classifiedManual = await classify.execute({ opportunityId: manual.id });

  return {
    opportunities,
    placements,
    verifications,
    evidence,
    auditLog,
    campaignId: campaign.id,
    classifiedOpportunityId: classified.id,
    classifiedManualOpportunityId: classifiedManual.id,
    approve: new ApproveOpportunityUseCase(opportunities, auditLog),
    execute: new ExecutePlacementUseCase(
      opportunities,
      placements,
      campaigns,
      companies,
      registry,
      auditLog,
    ),
    monitor: new MonitorPlacementUseCase(placements, registry, auditLog),
    verify: new VerifyPlacementUseCase(
      placements,
      opportunities,
      campaigns,
      companies,
      registry,
      verifications,
      evidence,
      auditLog,
    ),
    requestManual: new RequestManualPlacementUseCase(opportunities, placements, registry, auditLog),
    completeManual: new CompleteManualPlacementUseCase(placements, auditLog),
  };
}

async function approvedPlacement(
  harness: Harness,
): Promise<{ opportunity: PlacementOpportunity; placementId: string }> {
  const opportunity = await harness.approve.execute({
    opportunityId: harness.classifiedOpportunityId,
  });
  const placement = await harness.execute.execute({ opportunityId: opportunity.id });
  return { opportunity, placementId: placement.id };
}

describe('ApproveOpportunityUseCase', () => {
  it('transitions a QUALIFIED opportunity to SELECTED and audits it', async () => {
    const harness = await createHarness();

    const selected = await harness.approve.execute({
      opportunityId: harness.classifiedOpportunityId,
    });

    expect(selected.status).toBe('SELECTED');
    expect(harness.auditLog.entries.at(-1)).toMatchObject({
      action: 'OPPORTUNITY_SELECTED',
      entityId: selected.id,
    });
  });

  it('throws NotFoundError for a missing opportunity', async () => {
    const harness = await createHarness();

    await expect(harness.approve.execute({ opportunityId: 'missing' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('rejects approving an opportunity that is not QUALIFIED', async () => {
    const harness = await createHarness();
    await harness.approve.execute({ opportunityId: harness.classifiedOpportunityId });

    await expect(
      harness.approve.execute({ opportunityId: harness.classifiedOpportunityId }),
    ).rejects.toThrow(InvalidPlacementTransitionError);
  });
});

describe('ExecutePlacementUseCase', () => {
  it('prepares (SELECTED -> READY) and executes through the mock provider to PUBLISHED', async () => {
    const harness = await createHarness();
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedOpportunityId,
    });

    const placement = await harness.execute.execute({ opportunityId: opportunity.id });

    expect(placement.status).toBe('PUBLISHED');
    expect(placement.providerId).toBe('provider-1');
    expect(placement.externalId).toMatch(/^mock-/);
    expect(placement.submittedAt).not.toBeNull();
    expect(placement.publishedAt).not.toBeNull();
    expect(placement.liveUrl).toMatch(/^https:\/\/mock\.example\//);
    const storedOpportunity = harness.opportunities.opportunities.get(opportunity.id);
    expect(storedOpportunity?.status).toBe('READY');
    expect(harness.auditLog.entries.at(-1)).toMatchObject({
      action: 'PLACEMENT_PUBLISHED',
      entityId: placement.id,
    });
  });

  it('leaves the placement SUBMITTED when the provider reports a pending publication', async () => {
    const harness = await createHarness({ provider1: { alwaysPublish: false } });
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedOpportunityId,
    });

    const placement = await harness.execute.execute({ opportunityId: opportunity.id });

    expect(placement.status).toBe('SUBMITTED');
    expect(placement.liveUrl).toBeNull();
    expect(placement.publishedAt).toBeNull();
  });

  it('marks the placement FAILED and audits it when the provider create fails', async () => {
    const harness = await createHarness({ provider1: { failCreate: true } });
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedOpportunityId,
    });

    await expect(harness.execute.execute({ opportunityId: opportunity.id })).rejects.toThrow(
      ProviderError,
    );

    const placement = [...harness.placements.placements.values()][0];
    expect(placement?.status).toBe('FAILED');
    expect(harness.auditLog.entries.at(-1)).toMatchObject({
      action: 'PLACEMENT_FAILED',
      entityId: placement?.id,
    });
  });

  it('throws NoProviderAvailableError when no provider can execute the platform', async () => {
    const harness = await createHarness();

    // platform-2 only has a verified MANUAL provider (no CREATE capability),
    // so automatic execution must fail explicitly.
    const approved = await harness.approve.execute({
      opportunityId: harness.classifiedManualOpportunityId,
    });

    await expect(harness.execute.execute({ opportunityId: approved.id })).rejects.toThrow(
      NoProviderAvailableError,
    );
  });

  it('rejects executing an unapproved opportunity', async () => {
    const harness = await createHarness();

    await expect(
      harness.execute.execute({ opportunityId: harness.classifiedOpportunityId }),
    ).rejects.toThrow(InvalidPlacementTransitionError);
  });

  it('rejects a second execution once the placement is already submitted', async () => {
    const harness = await createHarness();
    const { opportunity } = await approvedPlacement(harness);

    await expect(harness.execute.execute({ opportunityId: opportunity.id })).rejects.toThrow(
      ValidationError,
    );
  });

  it('retries a FAILED placement with a fresh attempt that can succeed', async () => {
    const harness = await createHarness({ provider1: { failCreate: 1 } });
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedOpportunityId,
    });

    await expect(harness.execute.execute({ opportunityId: opportunity.id })).rejects.toThrow(
      ProviderError,
    );

    const failedAttempts = [...harness.placements.placements.values()];
    expect(failedAttempts).toHaveLength(1);
    expect(failedAttempts[0]?.status).toBe('FAILED');

    const retry = await harness.execute.execute({ opportunityId: opportunity.id });

    expect(retry.status).toBe('PUBLISHED');
    expect(retry.id).not.toBe(failedAttempts[0]?.id);
    const attempts = [...harness.placements.placements.values()];
    expect(attempts.map((attempt) => attempt.status).sort()).toEqual(['FAILED', 'PUBLISHED']);
    expect(harness.opportunities.opportunities.get(opportunity.id)?.status).toBe('READY');
    const actions = harness.auditLog.entries.map((entry) => entry.action);
    expect(actions).toContain('PLACEMENT_FAILED');
    expect(actions).toContain('PLACEMENT_PUBLISHED');
  });

  it('keeps rejecting retries while a previous attempt is still active', async () => {
    const harness = await createHarness({ provider1: { alwaysPublish: false } });
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedOpportunityId,
    });
    const placement = await harness.execute.execute({ opportunityId: opportunity.id });
    expect(placement.status).toBe('SUBMITTED');

    await expect(harness.execute.execute({ opportunityId: opportunity.id })).rejects.toThrow(
      ValidationError,
    );
    expect(harness.placements.placements.size).toBe(1);
  });
});

describe('RequestManualPlacementUseCase / CompleteManualPlacementUseCase', () => {
  it('marks a MANUAL-aligned selected opportunity NEEDS_MANUAL and creates the manual placement', async () => {
    const harness = await createHarness();
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedManualOpportunityId,
    });

    const placement = await harness.requestManual.execute({
      opportunityId: opportunity.id,
      reason: 'Complete the partner application on the platform',
    });

    expect(placement.status).toBe('NEEDS_MANUAL');
    expect(placement.providerId).toBe('provider-2');
    expect(harness.opportunities.opportunities.get(opportunity.id)?.status).toBe('NEEDS_MANUAL');
    expect(harness.auditLog.entries.at(-1)).toMatchObject({
      action: 'PLACEMENT_NEEDS_MANUAL',
      metadata: { reason: 'Complete the partner application on the platform' },
    });
  });

  it('rejects marking an API-aligned opportunity as manual', async () => {
    const harness = await createHarness();
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedOpportunityId,
    });

    await expect(
      harness.requestManual.execute({ opportunityId: opportunity.id, reason: 'nope' }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a manual request without a reason', async () => {
    const harness = await createHarness();
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedManualOpportunityId,
    });

    await expect(
      harness.requestManual.execute({ opportunityId: opportunity.id, reason: '   ' }),
    ).rejects.toThrow(ValidationError);
    expect(harness.placements.placements.size).toBe(0);
  });

  it('completes a manual placement to PUBLISHED with proof and verifies it afterwards', async () => {
    const harness = await createHarness();
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedManualOpportunityId,
    });
    const placement = await harness.requestManual.execute({
      opportunityId: opportunity.id,
      reason: 'Manual submission required',
    });

    const completed = await harness.completeManual.execute({
      placementId: placement.id,
      externalId: 'inmyroom/nordhaus',
      liveUrl: 'https://inmyroom.example/nordhaus',
      notes: 'Profile approved by the editor',
    });

    expect(completed.status).toBe('PUBLISHED');
    expect(completed.liveUrl).toBe('https://inmyroom.example/nordhaus');
    expect(completed.externalId).toBe('inmyroom/nordhaus');
    expect(completed.publishedAt).not.toBeNull();
    expect(completed.metadata).toMatchObject({ manual: true });
    expect(harness.auditLog.entries.at(-1)).toMatchObject({
      action: 'PLACEMENT_MANUALLY_PUBLISHED',
    });

    const { placement: verified } = await harness.verify.execute({ placementId: placement.id });
    expect(verified.status).toBe('VERIFIED');
    expect(harness.verifications.verifications.size).toBe(1);
  });

  it('rejects completing a manual placement without external id or live url', async () => {
    const harness = await createHarness();
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedManualOpportunityId,
    });
    const placement = await harness.requestManual.execute({
      opportunityId: opportunity.id,
      reason: 'Manual submission required',
    });

    await expect(
      harness.completeManual.execute({ placementId: placement.id, externalId: '', liveUrl: 'x' }),
    ).rejects.toThrow(ValidationError);
    await expect(
      harness.completeManual.execute({ placementId: placement.id, externalId: 'x', liveUrl: '' }),
    ).rejects.toThrow(ValidationError);
    expect([...harness.placements.placements.values()][0]?.status).toBe('NEEDS_MANUAL');
  });

  it('rejects completing a placement that is not waiting for manual work', async () => {
    const harness = await createHarness();
    const { placementId } = await approvedPlacement(harness);

    await expect(
      harness.completeManual.execute({
        placementId,
        externalId: 'x',
        liveUrl: 'https://example.com',
      }),
    ).rejects.toThrow(InvalidPlacementTransitionError);
  });
});

describe('MonitorPlacementUseCase', () => {
  it('transitions SUBMITTED to PUBLISHED when the provider reports publication', async () => {
    const harness = await createHarness({ provider1: { alwaysPublish: false } });
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedOpportunityId,
    });
    const placement = await harness.execute.execute({ opportunityId: opportunity.id });
    expect(placement.status).toBe('SUBMITTED');

    const monitored = await harness.monitor.execute({ placementId: placement.id });

    expect(monitored.status).toBe('PUBLISHED');
    expect(monitored.liveUrl).toMatch(/^https:\/\/mock\.example\//);
    expect(monitored.publishedAt).not.toBeNull();
    expect(harness.auditLog.entries.at(-1)).toMatchObject({
      action: 'PLACEMENT_STATUS_CHANGED',
      metadata: { from: 'SUBMITTED', to: 'PUBLISHED' },
    });
  });

  it('leaves non-active placements unchanged so the UI can refresh idempotently', async () => {
    const harness = await createHarness();
    const { placementId } = await approvedPlacement(harness);

    const monitored = await harness.monitor.execute({ placementId });

    expect(monitored.status).toBe('PUBLISHED');
  });

  it('transitions SUBMITTED to REJECTED when the provider reports a rejection', async () => {
    const harness = await createHarness({
      provider1: { timeline: ['pending_moderation', 'rejected'] },
    });
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedOpportunityId,
    });
    const placement = await harness.execute.execute({ opportunityId: opportunity.id });
    expect(placement.status).toBe('SUBMITTED');

    const monitored = await harness.monitor.execute({ placementId: placement.id });

    expect(monitored.status).toBe('REJECTED');
    expect(harness.auditLog.entries.at(-1)).toMatchObject({
      action: 'PLACEMENT_STATUS_CHANGED',
      metadata: { from: 'SUBMITTED', to: 'REJECTED' },
    });
  });

  it('transitions SUBMITTED to NEEDS_MANUAL when the platform requires a human step', async () => {
    const harness = await createHarness({
      provider1: { timeline: ['pending_moderation', 'needs_manual'] },
    });
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedOpportunityId,
    });
    const placement = await harness.execute.execute({ opportunityId: opportunity.id });

    const monitored = await harness.monitor.execute({ placementId: placement.id });

    expect(monitored.status).toBe('NEEDS_MANUAL');
  });

  it('transitions SUBMITTED to BLOCKED when the placement is stuck in processing', async () => {
    const harness = await createHarness({
      provider1: { timeline: ['pending_moderation', 'processing', 'blocked'] },
    });
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedOpportunityId,
    });
    const placement = await harness.execute.execute({ opportunityId: opportunity.id });

    const poll1 = await harness.monitor.execute({ placementId: placement.id });
    expect(poll1.status).toBe('PENDING_PUBLICATION');

    const poll2 = await harness.monitor.execute({ placementId: placement.id });
    expect(poll2.status).toBe('BLOCKED');
  });

  it('throws NotFoundError for a missing placement', async () => {
    const harness = await createHarness();

    await expect(harness.monitor.execute({ placementId: 'missing' })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('VerifyPlacementUseCase', () => {
  it('transitions PUBLISHED to VERIFIED and stores verification with evidence', async () => {
    const harness = await createHarness();
    const { placementId } = await approvedPlacement(harness);

    const { placement, verification } = await harness.verify.execute({ placementId });

    expect(placement.status).toBe('VERIFIED');
    expect(verification.status).toBe('PASSED');
    expect(harness.verifications.verifications.size).toBe(1);
    const entries = [...harness.evidence.evidence.values()].filter(
      (entry) => entry.verificationId === verification.id,
    );
    expect(entries.map((entry) => entry.type).sort()).toEqual([
      'BACKLINK_MATCH',
      'COMPANY_MATCH',
      'LIVE_URL',
      'WEBSITE_MATCH',
    ]);
    const liveUrl = entries.find((entry) => entry.type === 'LIVE_URL');
    expect(liveUrl?.url).toMatch(/^https:\/\/mock\.example\//);
    expect(harness.auditLog.entries.at(-1)).toMatchObject({
      action: 'PLACEMENT_VERIFIED',
      entityId: placement.id,
    });
  });

  it('transitions PUBLISHED to VERIFICATION_FAILED and stores failure details', async () => {
    const harness = await createHarness({ provider1: { failVerify: true } });
    const { placementId } = await approvedPlacement(harness);

    const { placement, verification } = await harness.verify.execute({ placementId });

    expect(placement.status).toBe('VERIFICATION_FAILED');
    expect(verification.status).toBe('FAILED');
    expect(verification.failureReason).toBe('Simulated verification failure');
    expect(harness.auditLog.entries.at(-1)).toMatchObject({
      action: 'PLACEMENT_VERIFICATION_FAILED',
    });
  });

  it('rejects verifying a placement that is not published without any side effects', async () => {
    const harness = await createHarness({ provider1: { alwaysPublish: false } });
    const opportunity = await harness.approve.execute({
      opportunityId: harness.classifiedOpportunityId,
    });
    const placement = await harness.execute.execute({ opportunityId: opportunity.id });
    expect(placement.status).toBe('SUBMITTED');

    await expect(harness.verify.execute({ placementId: placement.id })).rejects.toThrow(
      InvalidPlacementTransitionError,
    );
    // The eligibility check runs before the provider call and before any
    // persistence: no verification record, no evidence, no audit entry.
    expect(harness.verifications.verifications.size).toBe(0);
    expect(harness.evidence.evidence.size).toBe(0);
    expect(harness.auditLog.entries.some((entry) => entry.action.includes('VERIF'))).toBe(false);
  });

  it('throws NotFoundError for a missing placement', async () => {
    const harness = await createHarness();

    await expect(harness.verify.execute({ placementId: 'missing' })).rejects.toThrow(NotFoundError);
  });
});
