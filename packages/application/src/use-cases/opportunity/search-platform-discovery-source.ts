import type { PlacementCategory, Platform } from '@aios/domain';

import type {
  DiscoveryCandidate,
  DiscoverySourceInput,
  DiscoverySourceResult,
  PlatformDiscoverySource,
} from '../../ports/discovery-sources.js';

/**
 * Search-style discovery source.
 *
 * Represents a web/search research provider: it returns candidate platforms
 * from a provider-maintained knowledge base of platforms relevant to the
 * company. In the prototype this knowledge base is the demo platform catalog
 * subset injected by the composition root (see ADR-010); a real search/API
 * provider can replace it with live research behind the same port without
 * domain or application changes.
 *
 * The category filter is applied by DiscoverOpportunitiesUseCase, so this
 * source returns candidates for every category it knows.
 */
export class SearchPlatformDiscoverySource implements PlatformDiscoverySource {
  readonly name = 'search';

  constructor(
    private readonly platforms: readonly Platform[],
    private readonly categories: readonly PlacementCategory[],
  ) {}

  discover(_input: DiscoverySourceInput): Promise<DiscoverySourceResult> {
    const categoryCodeById = new Map(
      this.categories.map((category) => [category.id, category.code]),
    );
    const candidates: DiscoveryCandidate[] = this.platforms.map((platform) => ({
      platformId: platform.id,
      name: platform.name,
      url: platform.url,
      country: platform.country,
      categoryCode:
        platform.categoryId === null ? null : (categoryCodeById.get(platform.categoryId) ?? null),
      notes: platform.notes,
    }));
    return Promise.resolve({ candidates });
  }
}
