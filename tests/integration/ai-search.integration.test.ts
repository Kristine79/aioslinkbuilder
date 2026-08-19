import { describe, expect, it } from 'vitest';

import { AISearchClient } from '@aios/ai';
import {
  AISearchCitationsProvider,
  type SearchCitationsPort,
  type WebSearchProvider,
} from '@aios/integrations';

/**
 * Real integration against the search-capable AI provider (perplexity/sonar
 * on OpenRouter). Credential-dependent: skipped when AI_SEARCH_API_KEY is not
 * set. When it runs, it asserts REAL citations and REAL URLs — never demo or
 * synthetic data.
 */
const apiKey = (process.env.AI_SEARCH_API_KEY ?? '').trim();
const enabled = apiKey !== '';

describe('AISearchCitationsProvider (real, credential-dependent)', () => {
  it.runIf(enabled)('returns real citations for a live query', async () => {
    const client = new AISearchClient({
      apiKey,
      ...(process.env.AI_SEARCH_BASE_URL !== undefined &&
      process.env.AI_SEARCH_BASE_URL.trim() !== ''
        ? { baseUrl: process.env.AI_SEARCH_BASE_URL }
        : {}),
      ...(process.env.AI_SEARCH_MODEL !== undefined && process.env.AI_SEARCH_MODEL.trim() !== ''
        ? { model: process.env.AI_SEARCH_MODEL }
        : {}),
      capabilities: {
        supportsWebSearch: true,
        supportsCitations: true,
        supportsStructuredOutput: true,
        supportsUsage: true,
      },
      timeoutMs: 60_000,
    });
    const port: SearchCitationsPort = {
      providerName: client.providerName,
      model: client.model,
      searchCitations: (query, options) =>
        client.searchCitations(query, {
          ...(options?.maxResults !== undefined ? { maxResults: options.maxResults } : {}),
          ...(options?.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
        }),
    };
    const provider: WebSearchProvider = new AISearchCitationsProvider(port);

    const results = await provider.search(
      'мебельные каталоги и дизайн-порталы для размещения премиального мебельного бренда',
      { maxResults: 5, timeoutMs: 60_000 },
    );

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.url).toMatch(/^https?:\/\//);
      expect(result.domain).not.toBeNull();
      expect(result.source).toBe('ai-search');
    }
  });
});
