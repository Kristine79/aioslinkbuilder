import type { PlacementProvider as PlacementProviderEntity } from '@aios/domain';
import type { PlacementProviderRegistry } from '@aios/application';

import type { PlacementProvider } from '../contracts/placement-provider.js';
import { ProviderNotFoundError, ProviderUnavailableError } from '../errors.js';

export interface InMemoryPlacementProviderRegistryOptions {
  /**
   * Environment policy: when false, MOCK providers are excluded from listing
   * and resolution. The demo/test composition passes true; the production
   * composition passes false so a MOCK record can never be selected for
   * execution in production. The domain alignment logic stays pure — the
   * policy lives at the registry/composition boundary only.
   */
  allowMocks?: boolean;
}

/**
 * In-memory provider registry binding provider entity records to their
 * executable implementations. Used by tests and the prototype demo; a real
 * registry could read records from the database and resolve implementations
 * from a dependency-injection container.
 */
export class InMemoryPlacementProviderRegistry implements PlacementProviderRegistry {
  private readonly implementations = new Map<string, PlacementProvider>();

  constructor(
    private readonly entities: PlacementProviderEntity[],
    implementations: ReadonlyMap<string, PlacementProvider> = new Map(),
    private readonly options: InMemoryPlacementProviderRegistryOptions = {},
  ) {
    for (const [providerId, implementation] of implementations) {
      this.implementations.set(providerId, implementation);
    }
  }

  listByPlatformId(platformId: string): Promise<PlacementProviderEntity[]> {
    return Promise.resolve(
      this.entities.filter(
        (provider) => provider.platformId === platformId && this.isUsable(provider),
      ),
    );
  }

  listProviders(): Promise<PlacementProviderEntity[]> {
    return Promise.resolve(this.entities.filter((provider) => this.isUsable(provider)));
  }

  resolve(providerId: string): Promise<PlacementProvider> {
    const entity = this.entities.find((provider) => provider.id === providerId);
    if (entity !== undefined && !this.isUsable(entity)) {
      return Promise.reject(
        new ProviderUnavailableError(
          providerId,
          'MOCK providers are not usable in this environment',
        ),
      );
    }
    const implementation = this.implementations.get(providerId);
    if (implementation === undefined) {
      return Promise.reject(new ProviderNotFoundError(providerId));
    }
    return Promise.resolve(implementation);
  }

  private isUsable(provider: PlacementProviderEntity): boolean {
    if (this.options.allowMocks === false && provider.providerType === 'MOCK') {
      return false;
    }
    return true;
  }
}
