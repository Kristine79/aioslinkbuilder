/**
 * Search-capable AI bridge contract.
 *
 * WebSearchProvider implementations may be backed by a search engine or by a
 * search-capable AI provider. This port describes the latter: an AI endpoint
 * that performs real web search and returns the citations it actually used.
 * The adapter that implements WebSearchProvider maps those citations into the
 * existing WebSearchResult shape.
 *
 * The port lives here (not in @aios/ai) so the adapter layer has no
 * dependency on a concrete AI client; @aios/ai's AISearchClient satisfies
 * this shape structurally.
 */

import type { WebSearchOptions } from './web-search.js';

/** A single real source cited by a search-capable AI provider. */
export interface SearchCitation {
  url: string;
  title: string | null;
}

export interface SearchCitationsPort {
  readonly providerName: string;
  readonly model: string;
  /**
   * Runs a live web-search request and returns the real citations the
   * provider used. Throws when no citations were returned — plain LLM text
   * is never a source of discovered sites.
   */
  searchCitations(query: string, options?: WebSearchOptions): Promise<SearchCitation[]>;
}
