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
  /** All provider records usable in this environment (policy applied). This is
   * the single source of truth for provider display/alignment: the delivery
   * gate and the plan engine must read the same list the execution use cases
   * resolve from, so the UI can never offer an action the registry cannot
   * honor. */
  listProviders(): Promise<PlacementProviderEntity[]>;
  resolve(providerId: string): Promise<PlacementProvider>;
}
