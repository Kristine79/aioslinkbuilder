import type { PlacementCategory, PlacementProvider, Platform } from '@aios/domain';

export interface LookupRepository {
  listCategories(): Promise<PlacementCategory[]>;
  listPlatforms(): Promise<Platform[]>;
  listProviders(): Promise<PlacementProvider[]>;
}