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

  createPlatform(platform: Platform): Promise<Platform> {
    if (platform.url !== null) {
      const existing = this.platforms.find(
        (candidate) => candidate.url !== null && sameUrl(candidate.url, platform.url ?? ''),
      );
      if (existing !== undefined) {
        return Promise.resolve(existing);
      }
    } else {
      const existing = this.platforms.find(
        (candidate) => candidate.url === null && candidate.name === platform.name,
      );
      if (existing !== undefined) {
        return Promise.resolve(existing);
      }
    }
    this.platforms.push(platform);
    return Promise.resolve(platform);
  }
}

function sameUrl(a: string, b: string): boolean {
  try {
    return normalize(a) === normalize(b);
  } catch {
    return a.toLowerCase() === b.toLowerCase();
  }
}

function normalize(value: string): string {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  return url
    .toString()
    .replace(/\/$/, '')
    .replace(/^https?:\/\/(www\.)?/, '')
    .toLowerCase();
}
