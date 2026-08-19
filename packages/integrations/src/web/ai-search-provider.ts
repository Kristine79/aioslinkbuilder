/**
 * WebSearchProvider adapter backed by a search-capable AI provider.
 *
 * Bridge between the existing discovery pipeline (WebSearchProvider) and AI
 * endpoints that perform real web search and return real citations
 * (message.annotations[].url_citation, e.g. perplexity/* on OpenRouter).
 *
 * This is NOT a search engine and NOT an LLM-prose parser: every result is a
 * citation the provider actually used. A call that returns zero citations is
 * an explicit ProviderError — discovery never silently degrades to demo or to
 * invented sites.
 */

import { ProviderError } from '../errors.js';
import type { SearchCitationsPort, SearchCitation } from '../contracts/ai-search.js';
import type {
  WebSearchOptions,
  WebSearchProvider,
  WebSearchResult,
} from '../contracts/web-search.js';

const DEFAULT_MAX_RESULTS = 10;

export class AISearchCitationsProvider implements WebSearchProvider {
  readonly name = 'ai-search';
  private readonly client: SearchCitationsPort;

  constructor(client: SearchCitationsPort) {
    this.client = client;
  }

  async search(query: string, options?: WebSearchOptions): Promise<WebSearchResult[]> {
    if (query.trim() === '') {
      return [];
    }
    const maxResults = options?.maxResults ?? DEFAULT_MAX_RESULTS;

    let citations: SearchCitation[];
    try {
      citations = await this.client.searchCitations(query, {
        ...(options?.timeoutMs !== undefined && options.timeoutMs !== null
          ? { timeoutMs: options.timeoutMs }
          : {}),
        maxResults,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new ProviderError(
          this.name,
          'search',
          errorCategory(error),
          `Search-capable AI provider failed for query "${query.slice(0, 80)}": ${error.message}`,
          { cause: error },
        );
      }
      throw new ProviderError(
        this.name,
        'search',
        'UNKNOWN',
        `Search-capable AI provider failed for query "${query.slice(0, 80)}"`,
      );
    }

    if (citations.length === 0) {
      throw new ProviderError(
        this.name,
        'search',
        'UNKNOWN',
        `Search-capable AI provider returned no citations for query "${query.slice(0, 80)}" ` +
          '(an LLM answer without real citations is never treated as discovered sites)',
      );
    }

    const results: WebSearchResult[] = [];
    for (const citation of citations) {
      const url = citation.url.trim();
      if (!isHttpUrl(url)) continue;
      results.push({
        url,
        title: citation.title,
        snippet: null,
        domain: domainOf(url),
        source: this.name,
      });
      if (results.length >= maxResults) break;
    }
    return results;
  }
}

function errorCategory(error: unknown): 'UNKNOWN' | 'AUTH' | 'RATE_LIMIT' | 'TIMEOUT' | 'NETWORK' {
  if (!(error instanceof Error)) return 'UNKNOWN';
  const name = error.name;
  if (name.includes('Auth')) return 'AUTH';
  if (name.includes('RateLimit')) return 'RATE_LIMIT';
  if (name.includes('Timeout')) return 'TIMEOUT';
  if (name.includes('Network')) return 'NETWORK';
  return 'UNKNOWN';
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function domainOf(value: string): string | null {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}
