import type { PlacementCategory, PlacementProvider, Platform } from '@aios/domain';
import type { LookupRepository } from '@aios/application';

/**
 * In-memory implementation of LookupRepository. Used by the prototype
 * demo, the API composition and tests; the Prisma repositories remain the
 * production path.
 */
export class InMemoryLookupRepository implements LookupRepository {
  categories: PlacementCategory[] = [];
  platforms: Platform[] = [];
  providers: PlacementProvider[] = [];

  listCategories(): Promise<PlacementCategory[]> {
    return Promise.resolve(this.categories);
  }

  listPlatforms(): Promise<Platform[]> {
    return Promise.resolve(this.platforms);
  }

  listProviders(): Promise<PlacementProvider[]> {
    return Promise.resolve(this.providers);
  }
}
