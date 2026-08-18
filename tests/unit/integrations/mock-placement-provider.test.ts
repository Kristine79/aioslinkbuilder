import { describe, expect, it } from 'vitest';

import { UnsupportedCapabilityError } from '@aios/domain';
import {
  MockPlacementProvider,
  ProviderNotFoundError,
  ProviderUnavailableError,
} from '@aios/integrations';
import { InMemoryPlacementProviderRegistry } from '@aios/integrations';

import { seedProviders } from '../application/fakes.js';

const CAPABILITIES = ['CREATE', 'GET_STATUS', 'VERIFY'] as const;

const CREATE_INPUT = {
  opportunityId: 'opp-1',
  placementType: 'DIRECTORY_LISTING' as const,
  companyProfile: { name: 'Nordhaus', description: null, website: null },
};

describe('MockPlacementProvider', () => {
  it('implements the PlacementProvider contract surface', () => {
    const provider = new MockPlacementProvider('Mock', CAPABILITIES);
    expect(typeof provider.discover).toBe('function');
    expect(typeof provider.validate).toBe('function');
    expect(typeof provider.create).toBe('function');
    expect(typeof provider.update).toBe('function');
    expect(typeof provider.getStatus).toBe('function');
    expect(typeof provider.verify).toBe('function');
    expect(provider.providerType).toBe('MOCK');
    expect(provider.capabilities).toEqual([...CAPABILITIES]);
  });

  it('create returns a synthetic external id and publishes by default', async () => {
    const provider = new MockPlacementProvider('Mock', CAPABILITIES);

    const result = await provider.create(CREATE_INPUT);

    expect(result.externalId).toMatch(/^mock-/);
    expect(result.status).toBe('published');
    expect(result.liveUrl).toMatch(/^https:\/\/mock\.example\/placements\//);
  });

  it('create reports pending_publication when alwaysPublish is false', async () => {
    const provider = new MockPlacementProvider('Mock', CAPABILITIES, { alwaysPublish: false });

    const result = await provider.create(CREATE_INPUT);

    expect(result.status).toBe('pending_publication');
    expect(result.liveUrl).toBeNull();
  });

  it('create throws a structured ProviderError when failCreate is set', async () => {
    const provider = new MockPlacementProvider('Mock', CAPABILITIES, { failCreate: true });

    await expect(provider.create(CREATE_INPUT)).rejects.toMatchObject({
      name: 'ProviderError',
      category: 'PLATFORM',
      operation: 'create',
    });
  });

  it('failCreate as a number fails only that many initial create calls (retry path)', async () => {
    const provider = new MockPlacementProvider('Mock', CAPABILITIES, { failCreate: 1 });

    await expect(provider.create(CREATE_INPUT)).rejects.toMatchObject({
      name: 'ProviderError',
      category: 'PLATFORM',
    });
    const second = await provider.create(CREATE_INPUT);
    const third = await provider.create(CREATE_INPUT);

    expect(second.status).toBe('published');
    expect(third.status).toBe('published');
    expect(second.externalId).not.toBe(third.externalId);
  });

  it('walks a deterministic timeline across polls and sticks to the terminal status', async () => {
    const provider = new MockPlacementProvider('Mock', CAPABILITIES, {
      timeline: ['pending_moderation', 'pending_publication', 'published'],
    });

    const created = await provider.create(CREATE_INPUT);
    expect(created.status).toBe('pending_moderation');
    expect(created.liveUrl).toBeNull();

    const poll1 = await provider.getStatus({ externalId: created.externalId });
    expect(poll1.status).toBe('pending_publication');
    expect(poll1.liveUrl).toBeNull();
    expect(poll1.publishedAt).toBeNull();

    const poll2 = await provider.getStatus({ externalId: created.externalId });
    expect(poll2.status).toBe('published');
    expect(poll2.liveUrl).toMatch(/^https:\/\/mock\.example\//);
    expect(poll2.publishedAt).not.toBeNull();

    const poll3 = await provider.getStatus({ externalId: created.externalId });
    expect(poll3.status).toBe('published');
  });

  it('timeline can end in a terminal rejection', async () => {
    const provider = new MockPlacementProvider('Mock', CAPABILITIES, {
      timeline: ['pending_moderation', 'rejected'],
    });

    const created = await provider.create(CREATE_INPUT);
    const poll1 = await provider.getStatus({ externalId: created.externalId });
    const poll2 = await provider.getStatus({ externalId: created.externalId });

    expect(created.status).toBe('pending_moderation');
    expect(poll1.status).toBe('rejected');
    expect(poll2.status).toBe('rejected');
  });

  it('timeline can end in needs_manual and blocked terminal states', async () => {
    const manualProvider = new MockPlacementProvider('Mock', CAPABILITIES, {
      timeline: ['pending_moderation', 'needs_manual'],
    });
    const blockedProvider = new MockPlacementProvider('Mock', CAPABILITIES, {
      timeline: ['pending_moderation', 'processing', 'blocked'],
    });

    const createdManual = await manualProvider.create(CREATE_INPUT);
    expect((await manualProvider.getStatus({ externalId: createdManual.externalId })).status).toBe(
      'needs_manual',
    );
    const createdBlocked = await blockedProvider.create(CREATE_INPUT);
    const poll1 = await blockedProvider.getStatus({ externalId: createdBlocked.externalId });
    const poll2 = await blockedProvider.getStatus({ externalId: createdBlocked.externalId });
    expect(poll1.status).toBe('processing');
    expect(poll2.status).toBe('blocked');
  });

  it('verify passes when company and website match and no backlink is expected', async () => {
    const provider = new MockPlacementProvider('Mock', CAPABILITIES);

    const result = await provider.verify({
      externalId: 'mock-1',
      expected: {
        companyName: 'Nordhaus',
        website: 'https://nordhaus.example.com',
        expectedBacklink: null,
      },
    });

    expect(result.verified).toBe(true);
    expect(result.matchedCompanyName).toBe(true);
    expect(result.matchedWebsite).toBe(true);
    expect(result.liveUrl).toMatch(/^https:\/\/mock\.example\//);
  });

  it('verify confirms a backlink when one was expected', async () => {
    const provider = new MockPlacementProvider('Mock', CAPABILITIES);

    const result = await provider.verify({
      externalId: 'mock-1',
      expected: {
        companyName: 'Nordhaus',
        website: 'https://nordhaus.example.com',
        expectedBacklink: 'https://example.com/blog',
      },
    });

    // The mock simulates a platform that confirms the expected backlink; the
    // recorded find results stay explicit so verification is auditable.
    expect(result.foundBacklink).toBe(true);
    expect(result.verified).toBe(true);
  });

  it('rejects invoking a capability that is not declared', async () => {
    const provider = new MockPlacementProvider('Mock', ['VERIFY']);

    await expect(provider.create(CREATE_INPUT)).rejects.toThrow(UnsupportedCapabilityError);
  });
});

describe('InMemoryPlacementProviderRegistry', () => {
  it('lists entity records per platform', async () => {
    const registry = new InMemoryPlacementProviderRegistry(seedProviders());

    const entities = await registry.listByPlatformId('platform-1');

    expect(entities.map((entity) => entity.id)).toEqual(['provider-1']);
  });

  it('resolves registered implementations by id', async () => {
    const providers = seedProviders();
    const registry = new InMemoryPlacementProviderRegistry(
      providers,
      new Map([
        [
          providers[0]?.id ?? '',
          new MockPlacementProvider('Mock A', providers[0]?.capabilities ?? []),
        ],
      ]),
    );

    const implementation = await registry.resolve('provider-1');

    expect(implementation.providerType).toBe('MOCK');
  });

  it('throws ProviderNotFoundError for an unregistered provider', async () => {
    const registry = new InMemoryPlacementProviderRegistry([]);

    await expect(registry.resolve('missing')).rejects.toThrow(ProviderNotFoundError);
  });

  it('excludes MOCK providers from listing when allowMocks is false (production policy)', async () => {
    const registry = new InMemoryPlacementProviderRegistry(seedProviders(), new Map(), {
      allowMocks: false,
    });

    const mockPlatform = await registry.listByPlatformId('platform-1');
    const manualPlatform = await registry.listByPlatformId('platform-2');

    expect(mockPlatform).toEqual([]);
    expect(manualPlatform.map((entity) => entity.id)).toEqual(['provider-2']);
  });

  it('rejects resolving a MOCK provider when allowMocks is false', async () => {
    const providers = seedProviders();
    const registry = new InMemoryPlacementProviderRegistry(
      providers,
      new Map([
        [
          providers[0]?.id ?? '',
          new MockPlacementProvider('Mock A', providers[0]?.capabilities ?? []),
        ],
        [
          providers[1]?.id ?? '',
          new MockPlacementProvider('Manual B', providers[1]?.capabilities ?? []),
        ],
      ]),
      { allowMocks: false },
    );

    await expect(registry.resolve('provider-1')).rejects.toThrow(ProviderUnavailableError);
    await expect(registry.resolve('provider-2')).resolves.toBeInstanceOf(MockPlacementProvider);
  });
});
