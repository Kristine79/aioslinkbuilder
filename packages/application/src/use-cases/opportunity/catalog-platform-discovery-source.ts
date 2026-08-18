import type {
  DiscoveryCandidate,
  DiscoverySourceInput,
  DiscoverySourceResult,
  PlatformDiscoverySource,
} from '../../ports/discovery-sources.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';

/**
 * First concrete discovery source: emits the seeded platform catalog.
 *
 * The catalog is deliberately NOT treated as the architectural limit — this
 * source implements the same PlatformDiscoverySource port that future
 * API-based or AI/web-research discovery sources will implement. It ignores
 * the input profile because the catalog is static data; the discovery use
 * case applies the category filter on top of its candidates.
 */
export class CatalogPlatformDiscoverySource implements PlatformDiscoverySource {
  readonly name = 'catalog';

  constructor(private readonly lookups: LookupRepository) {}

  async discover(_input: DiscoverySourceInput): Promise<DiscoverySourceResult> {
    const [platforms, categories] = await Promise.all([
      this.lookups.listPlatforms(),
      this.lookups.listCategories(),
    ]);
    const categoryCodeById = new Map(categories.map((category) => [category.id, category.code]));
    const candidates: DiscoveryCandidate[] = platforms.map((platform) => ({
      platformId: platform.id,
      name: platform.name,
      url: platform.url,
      country: platform.country,
      categoryCode:
        platform.categoryId === null ? null : (categoryCodeById.get(platform.categoryId) ?? null),
      notes: platform.notes,
    }));
    return { candidates };
  }
}
