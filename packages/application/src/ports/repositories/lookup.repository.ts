import type { PlacementCategory, PlacementProvider, Platform } from '@aios/domain';

export interface LookupRepository {
  listCategories(): Promise<PlacementCategory[]>;
  listPlatforms(): Promise<Platform[]>;
  listProviders(): Promise<PlacementProvider[]>;
  /**
   * Registers a brand-new platform (discovered by web search or another
   * external source). Idempotent by normalized URL: calling this twice with
   * the same url returns the existing record. ADR-010 anticipates this port
   * ("no PlatformWriter port yet — added when a source needs it").
   */
  createPlatform(platform: Platform): Promise<Platform>;
}
