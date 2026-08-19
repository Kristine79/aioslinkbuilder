import { describe, expect, it } from 'vitest';

import {
  derivePlacementMethod,
  deriveProviderAlignment,
  EXECUTION_REQUIRED_CAPABILITIES,
  selectBestProvider,
  type PlacementProvider,
} from '@aios/domain';
import { ProviderNotFoundError, ProviderUnavailableError } from '@aios/integrations';

import { buildRegistry } from '../../../apps/api/src/prisma-environment.js';

/**
 * Mirrors the production Prisma seed (packages/infrastructure/prisma/seed.ts):
 * verified MOCK providers with CREATE/GET_STATUS/VERIFY for the catalog
 * platforms and a MANUAL provider for the manual flow.
 */
function seedLikeProviders(): PlacementProvider[] {
  const execCapabilities: readonly string[] = [
    'DISCOVER',
    'VALIDATE',
    'CREATE',
    'GET_STATUS',
    'VERIFY',
  ];
  return [
    {
      id: 'provider-yandex-business-mock',
      platformId: 'platform-yandex-business',
      name: 'Яндекс Бизнес MOCK',
      providerType: 'MOCK',
      capabilities: [...execCapabilities] as never,
      capabilitiesVerified: true,
      notes: null,
    },
    {
      id: 'provider-2gis-mock',
      platformId: 'platform-2gis',
      name: '2GIS MOCK',
      providerType: 'MOCK',
      capabilities: [...execCapabilities] as never,
      capabilitiesVerified: true,
      notes: null,
    },
    {
      id: 'provider-inmyroom-manual',
      platformId: 'platform-inmyroom',
      name: 'InMyRoom Manual',
      providerType: 'MANUAL',
      capabilities: ['VERIFY'],
      capabilitiesVerified: true,
      notes: null,
    },
  ] as PlacementProvider[];
}

describe('buildRegistry composition mock policy', () => {
  it('binds MOCK implementations when allowMocks=true (demo/test)', async () => {
    const registry = buildRegistry(seedLikeProviders(), true);

    const listed = await registry.listByPlatformId('platform-yandex-business');
    expect(listed.map((p) => p.id)).toContain('provider-yandex-business-mock');

    const impl = await registry.resolve('provider-yandex-business-mock');
    expect(impl.providerType).toBe('MOCK');
    expect(typeof impl.create).toBe('function');
    expect(typeof impl.getStatus).toBe('function');
    expect(typeof impl.verify).toBe('function');

    const best = selectBestProvider(listed, EXECUTION_REQUIRED_CAPABILITIES);
    expect(best?.id).toBe('provider-yandex-business-mock');
    expect(derivePlacementMethod(best)).toBe('API');
  });

  it('excludes MOCK providers from listing and resolution when allowMocks=false (production)', async () => {
    const registry = buildRegistry(seedLikeProviders(), false);

    const listed = await registry.listByPlatformId('platform-yandex-business');
    expect(listed).toEqual([]);

    await expect(registry.resolve('provider-yandex-business-mock')).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
    await expect(registry.resolve('provider-2gis-mock')).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );

    // No MOCK candidate can be selected for automated execution.
    expect(selectBestProvider(listed, EXECUTION_REQUIRED_CAPABILITIES)).toBeNull();
    expect(deriveProviderAlignment(listed, EXECUTION_REQUIRED_CAPABILITIES)).toMatchObject({
      provider: null,
      method: 'UNKNOWN',
    });
  });

  it('keeps the MANUAL flow working when allowMocks=false', async () => {
    const registry = buildRegistry(seedLikeProviders(), false);

    const listed = await registry.listByPlatformId('platform-inmyroom');
    expect(listed.map((p) => p.id)).toContain('provider-inmyroom-manual');
    expect(deriveProviderAlignment(listed, EXECUTION_REQUIRED_CAPABILITIES)).toMatchObject({
      method: 'MANUAL',
    });

    // No synthetic implementation is bound in deny mode: requesting one for
    // the manual provider is an explicit "not registered" error, never a fake
    // implementation that could fabricate verification results.
    await expect(registry.resolve('provider-inmyroom-manual')).rejects.toBeInstanceOf(
      ProviderNotFoundError,
    );
  });
});
