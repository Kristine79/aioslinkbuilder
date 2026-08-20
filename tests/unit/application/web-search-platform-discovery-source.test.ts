import { describe, expect, it } from 'vitest';

import type { GenerateSearchQueriesInput, DiscoverySourceInput } from '@aios/application';
import {
  DiscoverySearchFailedError,
  WebSearchPlatformDiscoverySource,
  normalizeUrlKey,
  platformIdFor,
} from '@aios/application';
import type { WebSearchProvider, WebSearchResult } from '@aios/integrations';
import { InMemoryLookupRepository } from '@aios/infrastructure';
import type { PlacementCategory } from '@aios/domain';

const CATEGORIES: PlacementCategory[] = [
  {
    id: 'cat-furniture',
    code: 'furniture-directories',
    name: 'Furniture',
    description: '',
    sortOrder: 1,
  },
  { id: 'cat-media', code: 'media-pr', name: 'Media', description: '', sortOrder: 2 },
];

class StubSearchProvider implements WebSearchProvider {
  readonly name = 'stub-search';
  calls: string[] = [];
  constructor(
    private readonly respond: (
      query: string,
    ) => WebSearchResult[] | Promise<WebSearchResult[]> = () => [],
  ) {}

  async search(query: string, options?: { maxResults?: number }): Promise<WebSearchResult[]> {
    this.calls.push(query);
    const results = await this.respond(query);
    return results.slice(0, options?.maxResults ?? 10);
  }
}

const INPUT: DiscoverySourceInput = {
  companyName: 'Nordhaus',
  description: 'Производитель премиальной мебели на заказ',
  industry: 'furniture',
  website: 'https://nordhaus.example.com',
  geography: ['Москва', 'Россия'],
  products: ['кухни', 'шкафы-купе'],
  targetAudience: ['дизайнеры интерьеров'],
  goals: ['Профили в мебельных каталогах'],
  strategyDirections: [],
};

function stubGenerator(queries: string[]) {
  return {
    name: 'stub-generator',
    generate: () =>
      Promise.resolve({
        intents: [{ intent: 'Каталоги', categoryCode: 'furniture-directories', queries }],
      }),
  };
}

function makeEnv() {
  const lookups = new InMemoryLookupRepository();
  lookups.categories = CATEGORIES;
  return lookups;
}

describe('WebSearchPlatformDiscoverySource', () => {
  it('discovers platforms, persists them and returns candidates with platformId', async () => {
    const lookups = makeEnv();
    const search = new StubSearchProvider(() => [
      {
        url: 'https://catalog.example.com/fabriki',
        title: 'Каталог фабрик',
        snippet: null,
        domain: 'catalog.example.com',
        source: 'stub-search',
      },
    ]);
    const source = new WebSearchPlatformDiscoverySource(
      lookups,
      search,
      stubGenerator(['мебельные каталоги России']),
    );

    const result = await source.discover(INPUT);

    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0];
    expect(candidate?.platformId).toMatch(/^platform-ws-/);
    expect(candidate?.name).toBe('Каталог фабрик');
    expect(candidate?.url).toBe('https://catalog.example.com/fabriki');
    expect(candidate?.country).toBe('Russia');
    expect(candidate?.categoryCode).toBe('furniture-directories');
    const stored = await lookups.listPlatforms();
    expect(stored.some((platform) => platform.id === candidate?.platformId)).toBe(true);
    expect(stored[0]?.metadata).toMatchObject({
      discoveredVia: 'web-search',
      searchEngine: 'stub-search',
    });
  });

  it('passes strategy directions (catalog-backed and AI-derived) into the search-intent generator', async () => {
    const lookups = makeEnv();
    const search = new StubSearchProvider();
    const received: GenerateSearchQueriesInput[] = [];
    const spyGenerator = {
      name: 'spy-generator',
      generate: (input: GenerateSearchQueriesInput) => {
        received.push(input);
        return Promise.resolve({
          intents: [{ intent: 'Направление', categoryCode: 'media-pr', queries: ['q'] }],
        });
      },
    };
    const source = new WebSearchPlatformDiscoverySource(lookups, search, spyGenerator);

    await source.discover({
      ...INPUT,
      strategyDirections: [
        {
          categoryId: 'cat-media',
          categoryCode: 'media-pr',
          categoryName: 'Media',
          placementType: 'EDITORIAL_PUBLICATION',
        },
        {
          categoryId: null,
          categoryCode: 'chatbot-development',
          categoryName: 'chatbot-development',
          placementType: 'DIRECTORY_LISTING',
        },
      ],
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.relevantCategoryCodes).toEqual(['media-pr', 'chatbot-development']);
    // The available list stays the catalog — the generator must not be told
    // that AI-derived codes are catalog categories.
    expect(received[0]?.availableCategoryCodes).toEqual(['furniture-directories', 'media-pr']);
    // The full company profile reaches the generator: real description,
    // industry, website, products and audience drive concrete queries.
    expect(received[0]?.company).toMatchObject({
      name: 'Nordhaus',
      description: 'Производитель премиальной мебели на заказ',
      industry: 'furniture',
      website: 'https://nordhaus.example.com',
      geography: ['Москва', 'Россия'],
      products: ['кухни', 'шкафы-купе'],
      targetAudience: ['дизайнеры интерьеров'],
    });
  });

  it('reuses already-registered platforms instead of duplicating them', async () => {
    const lookups = makeEnv();
    lookups.platforms = [
      {
        id: 'platform-existing',
        name: 'Existing Catalog',
        url: 'https://catalog.example.com/fabriki',
        country: 'Russia',
        categoryId: null,
        notes: null,
        metadata: {},
      },
    ];
    const search = new StubSearchProvider(() => [
      {
        url: 'https://catalog.example.com/fabriki',
        title: 'Каталог фабрик',
        snippet: null,
        domain: 'catalog.example.com',
        source: 'stub-search',
      },
    ]);
    const source = new WebSearchPlatformDiscoverySource(lookups, search, stubGenerator(['q']));

    const result = await source.discover(INPUT);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.platformId).toBe('platform-existing');
    expect(await lookups.listPlatforms()).toHaveLength(1);
  });

  it('dedupes results that point at the same normalized URL', async () => {
    const lookups = makeEnv();
    const search = new StubSearchProvider(() => [
      {
        url: 'https://catalog.example.com/fabriki?utm_source=1',
        title: 'Alpha catalog',
        snippet: null,
        domain: 'catalog.example.com',
        source: 'stub-search',
      },
      {
        url: 'https://catalog.example.com/fabriki',
        title: 'Beta catalog',
        snippet: null,
        domain: 'catalog.example.com',
        source: 'stub-search',
      },
    ]);
    const source = new WebSearchPlatformDiscoverySource(lookups, search, stubGenerator(['q']));

    const result = await source.discover(INPUT);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.name).toBe('Alpha catalog');
  });

  it('caps the number of executed queries', async () => {
    const lookups = makeEnv();
    const search = new StubSearchProvider();
    const generator = stubGenerator(Array.from({ length: 30 }, (_, i) => `query-${i}`));
    const source = new WebSearchPlatformDiscoverySource(lookups, search, generator, {
      maxQueries: 5,
    });

    await source.discover(INPUT);
    expect(search.calls).toHaveLength(5);
  });

  it('spends the query budget fairly across intents (round-robin)', async () => {
    const lookups = makeEnv();
    const search = new StubSearchProvider();
    const generator = {
      name: 'multi-intent-generator',
      generate: () =>
        Promise.resolve({
          intents: [
            {
              intent: 'Каталоги',
              categoryCode: 'furniture-directories',
              queries: ['a1', 'a2', 'a3'],
            },
            { intent: 'Медиа', categoryCode: 'media-pr', queries: ['b1', 'b2', 'b3'] },
            { intent: 'Локальные', categoryCode: null, queries: ['c1', 'c2', 'c3'] },
          ],
        }),
    };
    const source = new WebSearchPlatformDiscoverySource(lookups, search, generator, {
      maxQueries: 5,
    });

    await source.discover(INPUT);

    // Every intent yields its first query before any intent yields a second,
    // so later directions are never starved by the flat cap.
    expect(search.calls).toEqual(['a1', 'b1', 'c1', 'a2', 'b2']);
  });

  it('excludes intents with unknown category codes from the query budget', async () => {
    const lookups = makeEnv();
    const search = new StubSearchProvider();
    const generator = {
      name: 'unknown-category-generator',
      generate: () =>
        Promise.resolve({
          intents: [
            { intent: 'Каталоги', categoryCode: 'furniture-directories', queries: ['a1', 'a2'] },
            { intent: 'Неизвестно', categoryCode: 'no-such-code', queries: ['x1', 'x2'] },
          ],
        }),
    };
    const source = new WebSearchPlatformDiscoverySource(lookups, search, generator, {
      maxQueries: 10,
    });

    await source.discover(INPUT);
    expect(search.calls).toEqual(['a1', 'a2']);
  });

  it('keeps working when a single query fails, but fails when all fail', async () => {
    const lookups = makeEnv();
    const search = new StubSearchProvider(() => {
      throw new Error('engine down');
    });
    const failing = new WebSearchPlatformDiscoverySource(
      lookups,
      search,
      stubGenerator(['q1', 'q2']),
    );
    await expect(failing.discover(INPUT)).rejects.toBeInstanceOf(DiscoverySearchFailedError);

    const partial = new StubSearchProvider((query) =>
      query === 'bad'
        ? Promise.reject(new Error('down'))
        : Promise.resolve([
            {
              url: 'https://ok.example.com/',
              title: 'OK',
              snippet: null,
              domain: 'ok.example.com',
              source: 'stub-search',
            },
          ]),
    );
    const source = new WebSearchPlatformDiscoverySource(
      lookups,
      partial,
      stubGenerator(['bad', 'good']),
    );
    const result = await source.discover(INPUT);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.url).toBe('https://ok.example.com/');
  });

  it('supports the deterministic generator path end-to-end', async () => {
    const lookups = makeEnv();
    const search = new StubSearchProvider(() => [
      {
        url: 'https://media.example.com/mebel',
        title: 'СМИ',
        snippet: null,
        domain: 'media.example.com',
        source: 'stub-search',
      },
    ]);
    const source = new WebSearchPlatformDiscoverySource(lookups, search, stubGenerator(['q']));

    const result = await source.discover(INPUT);
    expect(result.candidates[0]?.categoryCode).toBe('furniture-directories');
  });
});

describe('normalizeUrlKey', () => {
  it('normalizes protocol, host case, search/hash and trailing slashes', () => {
    expect(normalizeUrlKey('HTTPS://WWW.EXAMPLE.COM///?a=1#frag')).toBe('https://www.example.com');
    expect(normalizeUrlKey('https://example.com/a')).toBe('https://example.com/a');
  });

  it('falls back to the raw value for invalid URLs', () => {
    expect(normalizeUrlKey('not a url')).toBe('not a url');
  });
});

describe('platformIdFor', () => {
  it('is deterministic across calls', () => {
    const url = 'https://catalog.example.com/fabriki?utm=1';
    expect(platformIdFor({ url })).toBe(platformIdFor({ url }));
    expect(platformIdFor({ url })).toMatch(/^platform-ws-catalog-example-com-/);
  });
});
