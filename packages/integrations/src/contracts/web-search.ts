/**
 * Web search provider port.
 *
 * Real web discovery (see WebSearchPlatformDiscoverySource) depends on this
 * contract, not on a concrete search engine. Implementations return raw
 * search results (URL/title/snippet/domain) with no quality interpretation —
 * scoring happens later in the domain. Results are MEASURED/EXTERNAL data:
 * the provider never fabricates URLs.
 */

export interface WebSearchResult {
  url: string;
  title: string | null;
  snippet: string | null;
  /** Registered host of the result URL (lowercased, no www). */
  domain: string | null;
  /** Search engine id (e.g. "duckduckgo"). */
  source: string;
}

export interface WebSearchOptions {
  /** Cap on returned results (default provider-specific). */
  maxResults?: number;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
}

export interface WebSearchProvider {
  readonly name: string;
  search(query: string, options?: WebSearchOptions): Promise<WebSearchResult[]>;
}
