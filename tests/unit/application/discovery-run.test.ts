import { describe, expect, it } from 'vitest';

import { DiscoverOpportunitiesUseCase } from '@aios/application';
import type { PlatformDiscoverySource } from '@aios/application';
import { CatalogPlatformDiscoverySource } from '@aios/application';

import {
  InMemoryAuditLogRepository,
  InMemoryCampaignRepository,
  InMemoryCompanyRepository,
  InMemoryDiscoveryRunRepository,
  InMemoryLookupRepository,
  InMemoryPlacementOpportunityRepository,
  seedCategories,
  seedPlatforms,
  seedProviders,
} from './fakes.js';

async function createHarness() {
  const companies = new InMemoryCompanyRepository();
  const campaigns = new InMemoryCampaignRepository();
  const lookups = new InMemoryLookupRepository();
  const opportunities = new InMemoryPlacementOpportunityRepository();
  const auditLog = new InMemoryAuditLogRepository();
  const discoveryRuns = new InMemoryDiscoveryRunRepository();

  const company = await companies.create({ name: 'Nordhaus' });
  const campaign = await campaigns.create({
    companyId: company.id,
    name: 'Demo',
    goals: ['Grow visibility'],
  });

  return {
    companies,
    campaigns,
    lookups,
    opportunities,
    auditLog,
    discoveryRuns,
    campaignId: campaign.id,
  };
}

function discoverWith(
  harness: Awaited<ReturnType<typeof createHarness>>,
  sources: readonly PlatformDiscoverySource[],
  runs: InMemoryDiscoveryRunRepository = harness.discoveryRuns,
): DiscoverOpportunitiesUseCase {
  harness.lookups.categories = seedCategories();
  harness.lookups.platforms = seedPlatforms();
  harness.lookups.providers = seedProviders();
  return new DiscoverOpportunitiesUseCase(
    harness.campaigns,
    harness.companies,
    harness.lookups,
    harness.opportunities,
    harness.auditLog,
    sources,
    runs,
  );
}

describe('discovery run lifecycle (use case)', () => {
  it('persists RUNNING → COMPLETED_WITH_RESULTS with metadata and classified count', async () => {
    const harness = await createHarness();
    const catalog = new CatalogPlatformDiscoverySource(harness.lookups);
    const discover = discoverWith(harness, [catalog]);

    const discovered = await discover.execute({
      campaignId: harness.campaignId,
      placementType: 'BUSINESS_PROFILE',
      categoryCodes: ['WEB_DIRECTORIES'],
    });

    expect(discovered.length).toBeGreaterThan(0);
    await discover.recordClassified(harness.campaignId, discovered.length);

    const run = await harness.discoveryRuns.findLatestForCampaign(harness.campaignId);
    expect(run?.status).toBe('COMPLETED_WITH_RESULTS');
    expect(run?.discoveredCount).toBe(discovered.length);
    expect(run?.classifiedCount).toBe(discovered.length);
    expect(run?.sources).toContain('catalog');
    expect(run?.failure).toBeNull();
    expect(run?.lastRunAt).not.toBeNull();
  });

  it('persists COMPLETED_EMPTY when sources find nothing', async () => {
    const harness = await createHarness();
    const emptySource: PlatformDiscoverySource = {
      name: 'empty',
      discover: () => Promise.resolve({ candidates: [] }),
    };
    const discover = discoverWith(harness, [emptySource]);

    const discovered = await discover.execute({
      campaignId: harness.campaignId,
      placementType: 'BUSINESS_PROFILE',
      categoryCodes: [],
    });

    expect(discovered).toHaveLength(0);
    const run = await harness.discoveryRuns.findLatestForCampaign(harness.campaignId);
    expect(run?.status).toBe('COMPLETED_EMPTY');
    expect(run?.discoveredCount).toBe(0);
  });

  it('persists FAILED (never COMPLETED_EMPTY) when a source errors and rethrows', async () => {
    const harness = await createHarness();
    const failingSource: PlatformDiscoverySource = {
      name: 'flaky',
      discover: () => Promise.reject(new Error('search provider timed out')),
    };
    const discover = discoverWith(harness, [failingSource]);

    await expect(
      discover.execute({ campaignId: harness.campaignId, placementType: 'BUSINESS_PROFILE' }),
    ).rejects.toThrow('search provider timed out');

    const run = await harness.discoveryRuns.findLatestForCampaign(harness.campaignId);
    expect(run?.status).toBe('FAILED');
    expect(run?.failure).toContain('search provider timed out');
  });

  it('reports a classification count into the completed run', async () => {
    const harness = await createHarness();
    const catalog = new CatalogPlatformDiscoverySource(harness.lookups);
    const discover = discoverWith(harness, [catalog]);

    await discover.execute({
      campaignId: harness.campaignId,
      placementType: 'BUSINESS_PROFILE',
      categoryCodes: ['WEB_DIRECTORIES'],
    });
    const before = await harness.discoveryRuns.findLatestForCampaign(harness.campaignId);
    expect(before?.classifiedCount).toBe(0);

    await discover.recordClassified(harness.campaignId, 5);
    const after = await harness.discoveryRuns.findLatestForCampaign(harness.campaignId);
    expect(after?.classifiedCount).toBe(5);
  });

  it('does not mutate a FAILED run via recordClassified', async () => {
    const harness = await createHarness();
    const failingSource: PlatformDiscoverySource = {
      name: 'flaky',
      discover: () => Promise.reject(new Error('boom')),
    };
    const discover = discoverWith(harness, [failingSource]);

    await expect(
      discover.execute({ campaignId: harness.campaignId, placementType: 'BUSINESS_PROFILE' }),
    ).rejects.toThrow('boom');

    await discover.recordClassified(harness.campaignId, 3);
    const run = await harness.discoveryRuns.findLatestForCampaign(harness.campaignId);
    expect(run?.status).toBe('FAILED');
    expect(run?.classifiedCount).toBe(0);
  });

  it('ignores recordClassified when the campaign never ran', async () => {
    const harness = await createHarness();
    const discover = discoverWith(harness, []);

    await discover.recordClassified(harness.campaignId, 2);
    const run = await harness.discoveryRuns.findLatestForCampaign(harness.campaignId);
    expect(run).toBeNull();
  });
});
