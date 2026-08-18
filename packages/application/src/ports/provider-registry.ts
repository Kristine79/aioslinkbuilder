import type { PlacementProvider as PlacementProviderEntity } from '@aios/domain';
import type { PlacementProvider } from '@aios/integrations';

/**
 * Registry of executable placement providers.
 *
 * listByPlatformId returns the provider entity records (used for
 * deterministic alignment); resolve returns the executable implementation
 * bound to that record. Implementations are provided by the infrastructure
 * layer (MockProvider in the prototype).
 */
export interface PlacementProviderRegistry {
  listByPlatformId(platformId: string): Promise<PlacementProviderEntity[]>;
  resolve(providerId: string): Promise<PlacementProvider>;
}
