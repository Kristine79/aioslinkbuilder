import { describe, expect, it } from 'vitest';

import {
  EXECUTION_REQUIRED_CAPABILITIES,
  derivePlacementMethod,
  selectBestProvider,
} from '@aios/domain';
import { ProviderUnavailableError } from '@aios/integrations';

import { createPrismaEnvironment } from '../../apps/api/src/prisma-environment.js';
import { loadRuntimeConfig } from '../../apps/api/src/runtime-config.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeDb = hasDatabase ? describe : describe.skip;

/**
 * Composition-level proof for ADR-015: the production chain
 * RuntimeConfig -> createPrismaEnvironment -> provider registry must make
 * automated execution against MOCK providers impossible when
 * MOCK_PROVIDERS=deny (the default), and must keep the demo/test chain
 * working when MOCK_PROVIDERS=allow.
 *
 * Requires a migrated + seeded Neon database (pnpm db:migrate && pnpm db:seed).
 */
describeDb('production composition mock provider policy', () => {
  it('deny: MOCK providers are excluded from listing, resolution and selection', async () => {
    const config = loadRuntimeConfig({ ...process.env, MOCK_PROVIDERS: 'deny' });
    expect(config.allowMockProviders).toBe(false);

    const env = await createPrismaEnvironment(config);
    try {
      const providers = await env.lookups.listProviders();
      const mock = providers.find((provider) => provider.providerType === 'MOCK');
      expect(mock, 'seed must contain a MOCK provider (run: pnpm db:seed)').toBeDefined();
      expect(mock?.providerType).toBe('MOCK');

      const listed = await env.registry.listByPlatformId(mock!.platformId);
      expect(listed.map((provider) => provider.id)).not.toContain(mock!.id);

      await expect(env.registry.resolve(mock!.id)).rejects.toBeInstanceOf(ProviderUnavailableError);

      const best = selectBestProvider(listed, EXECUTION_REQUIRED_CAPABILITIES);
      expect(best).toBeNull();
      expect(derivePlacementMethod(best)).toBe('UNKNOWN');
    } finally {
      await env.db.$disconnect();
    }
  });

  it('allow: the same production composition binds MOCK implementations (demo/test)', async () => {
    const config = loadRuntimeConfig({ ...process.env, MOCK_PROVIDERS: 'allow' });
    expect(config.allowMockProviders).toBe(true);

    const env = await createPrismaEnvironment(config);
    try {
      const providers = await env.lookups.listProviders();
      const mock = providers.find((provider) => provider.providerType === 'MOCK');
      expect(mock, 'seed must contain a MOCK provider (run: pnpm db:seed)').toBeDefined();

      const listed = await env.registry.listByPlatformId(mock!.platformId);
      expect(listed.map((provider) => provider.id)).toContain(mock!.id);

      const impl = await env.registry.resolve(mock!.id);
      expect(impl.providerType).toBe('MOCK');
      expect(typeof impl.create).toBe('function');

      const best = selectBestProvider(listed, EXECUTION_REQUIRED_CAPABILITIES);
      expect(best).not.toBeNull();
      expect(best?.id).toBe(mock!.id);
      expect(derivePlacementMethod(best)).toBe('API');
    } finally {
      await env.db.$disconnect();
    }
  });
});
