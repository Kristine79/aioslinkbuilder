import type { Platform } from '@aios/domain';
import type { WebSearchProvider } from '@aios/integrations';

import type {
  DiscoveryCandidate,
  DiscoverySourceInput,
  DiscoverySourceResult,
  PlatformDiscoverySource,
} from '../../ports/discovery-sources.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';
import type { SearchQueryGenerator } from '../../ports/search-query-generator.js';

export interface WebSearchDiscoveryOptions {
  /** Hard cap on executed queries (cost/rate-limit protection). */
  maxQueries?: number;
  /** Hard cap on raw results per query. */
  maxResultsPerQuery?: number;
  /** Hard cap on returned candidates. */
  maxCandidates?: number;
  /** Concurrent search requests. */
  concurrency?: number;
  /** Merge results that belong to the same platform (by URL). */
  dedupe?: boolean;
}

const DEFAULT_OPTIONS: Required<WebSearchDiscoveryOptions> = {
  maxQueries: 10,
  maxResultsPerQuery: 8,
  maxCandidates: 40,
  concurrency: 2,
  dedupe: true,
};

/**
 * Real web discovery source: strategy directions → search intents → web
 * search → real URLs → dedupe → register platforms → candidates.
 *
 * Implements the existing PlatformDiscoverySource port. Every result is real
 * external data (MEASURED); the source never invents platforms. Brand-new
 * sites are persisted into the platform catalog via LookupRepository
 * (ADR-010: "a source that finds a brand-new site must persist it in the
 * catalog first") and returned with their platformId. Failures of the search
 * provider or the query generator propagate as controlled errors — real data
 * is never silently replaced with fake data.
 */
export class WebSearchPlatformDiscoverySource implements PlatformDiscoverySource {
  readonly name = 'web-search';

  constructor(
    private readonly lookups: LookupRepository,
    private readonly search: WebSearchProvider,
    private readonly queryGenerator: SearchQueryGenerator,
    private readonly options: WebSearchDiscoveryOptions = {},
  ) {}

  async discover(input: DiscoverySourceInput): Promise<DiscoverySourceResult> {
    const categories = await this.lookups.listCategories();
    const platforms = await this.lookups.listPlatforms();
    const options = { ...DEFAULT_OPTIONS, ...this.options };

    const plan = await this.queryGenerator.generate({
      company: {
        name: input.companyName,
        description: null,
        industry: null,
        website: null,
        geography: input.geography,
        products: [],
        targetAudience: [],
      },
      campaignGoals: input.goals,
      // Search context comes from the campaign's real strategy directions
      // (catalog-backed or AI-derived) — never from "every catalog category".
      // The generator decides which directions are worth researching.
      relevantCategoryCodes: input.strategyDirections.map((direction) => direction.categoryCode),
      availableCategoryCodes: categories.map((category) => category.code),
    });

    // Safety nets: cap queries, drop intents whose category is unknown.
    const availableCodes = new Set(categories.map((category) => category.code));
    const queries = plan.intents
      .flatMap((intent) =>
        intent.categoryCode !== null && !availableCodes.has(intent.categoryCode)
          ? []
          : intent.queries,
      )
      .slice(0, options.maxQueries);

    const rawResults = await this.runSearches(queries, options);

    const normalized = normalizeResults(rawResults, options);
    const categoryByUrl = categoryHintByUrl(normalized, plan.intents);

    const existingByUrl = new Map(
      platforms
        .filter((platform) => platform.url !== null)
        .map((platform) => [normalizeUrlKey(platform.url ?? ''), platform]),
    );

    const candidates: DiscoveryCandidate[] = [];
    for (const result of normalized) {
      const key = normalizeUrlKey(result.url);
      const existing = existingByUrl.get(key);
      let platform: Platform;
      if (existing !== undefined) {
        platform = existing;
      } else {
        platform = await this.lookups.createPlatform({
          id: platformIdFor(result),
          name: platformNameFor(result),
          url: result.url,
          country: countryFor(input.geography),
          categoryId: null,
          notes: `Web-discovered platform (${this.search.name}; query: ${result.query ?? ''})`,
          metadata: {
            discoveredVia: 'web-search',
            searchEngine: this.search.name,
            title: result.title,
            snippet: result.snippet,
          },
        });
        existingByUrl.set(key, platform);
      }
      const categoryId = categoryByUrl.has(result.url)
        ? (categoryByUrl.get(result.url) ?? null)
        : null;
      candidates.push({
        platformId: platform.id,
        name: platform.name,
        url: platform.url,
        country: platform.country,
        categoryCode: categoryId,
        notes: result.title ?? null,
      });
      if (candidates.length >= options.maxCandidates) break;
    }

    return { candidates };
  }

  /** Runs searches with bounded concurrency; a single query failure is recorded, not fatal. */
  private async runSearches(
    queries: string[],
    options: Required<WebSearchDiscoveryOptions>,
  ): Promise<WebSearchCandidate[]> {
    const results: WebSearchCandidate[] = [];
    let index = 0;
    let failures = 0;
    const workers = Array.from(
      { length: Math.max(1, Math.min(options.concurrency, queries.length)) },
      async () => {
        while (index < queries.length) {
          const query = queries[index];
          index += 1;
          if (query === undefined) continue;
          try {
            const found = await this.search.search(query, {
              maxResults: options.maxResultsPerQuery,
            });
            for (const item of found) {
              results.push({ ...item, query });
            }
          } catch (error) {
            // Controlled degradation: one failed query must not kill the
            // whole discovery; results from other queries stay real.
            failures += 1;
            void error;
          }
        }
      },
    );
    await Promise.all(workers);
    // Every query failed: the search engine is unreachable/broken — surface
    // an explicit error instead of returning a silent "nothing found".
    if (queries.length > 0 && failures === queries.length) {
      throw new DiscoverySearchFailedError(this.search.name, queries.length);
    }
    return results.slice(0, options.maxResultsPerQuery * options.maxQueries);
  }
}

export class DiscoverySearchFailedError extends Error {
  constructor(
    readonly providerName: string,
    readonly attemptedQueries: number,
  ) {
    super(
      `Web search failed (${providerName}): ${attemptedQueries} query(ies) attempted, no results returned`,
    );
    this.name = 'DiscoverySearchFailedError';
  }
}

interface WebSearchCandidate {
  url: string;
  title: string | null;
  snippet: string | null;
  domain: string | null;
  source: string;
  query: string;
}

/** Dedupes by normalized URL; keeps the first title/snippet/query per URL. */
function normalizeResults(
  results: WebSearchCandidate[],
  options: Required<WebSearchDiscoveryOptions>,
): WebSearchCandidate[] {
  const seen = new Set<string>();
  const unique: WebSearchCandidate[] = [];
  for (const result of results) {
    if (options.dedupe) {
      const key = normalizeUrlKey(result.url);
      if (seen.has(key)) continue;
      seen.add(key);
    }
    unique.push(result);
    if (unique.length >= options.maxCandidates) break;
  }
  return unique;
}

/** Maps a result URL to the category code of the intent that found it. */
function categoryHintByUrl(
  results: WebSearchCandidate[],
  intents: Array<{ categoryCode: string | null; queries: string[] }>,
): Map<string, string | null> {
  const categoryByQuery = new Map<string, string | null>();
  for (const intent of intents) {
    for (const query of intent.queries) {
      categoryByQuery.set(query.trim().toLowerCase(), intent.categoryCode);
    }
  }
  const map = new Map<string, string | null>();
  for (const result of results) {
    const category = categoryByQuery.get((result.query ?? '').trim().toLowerCase()) ?? null;
    map.set(result.url, category);
  }
  return map;
}

/** Stable deterministic platform id from the result URL. */
export function platformIdFor(result: { url: string }): string {
  const domain = (result.url.match(/^https?:\/\/([^/]+)/i) ?? [null, 'unknown'])[1] ?? 'unknown';
  const slug = domain
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const hash = shortHash(result.url);
  return `platform-ws-${slug}-${hash}`;
}

function platformNameFor(result: WebSearchCandidate): string {
  const cleanTitle = (result.title ?? '').replace(/\s+/g, ' ').trim();
  if (cleanTitle.length >= 3) {
    return cleanTitle.length <= 72 ? cleanTitle : `${cleanTitle.slice(0, 69)}…`;
  }
  return result.domain ?? new URL(result.url).hostname;
}

function countryFor(geography: string[]): string | null {
  const region = geography.find((entry) => /^(росси|рф|russia)/i.test(entry));
  if (region !== undefined) return 'Russia';
  return geography[0] ?? null;
}

export function normalizeUrlKey(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    const pathname = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.hostname.toLowerCase()}${pathname}`;
  } catch {
    return value.toLowerCase();
  }
}

function shortHash(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return (Math.abs(hash) % 0xffffffff).toString(36);
}
