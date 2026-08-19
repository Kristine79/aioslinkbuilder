/**
 * Real web search provider on top of DuckDuckGo HTML search
 * (https://html.duckduckgo.com/html/). No API key required — the endpoint
 * returns server-rendered results that we parse for URL/title/snippet.
 *
 * Data policy: results are real external data (MEASURED); the provider never
 * synthesizes URLs. Failures (timeout, HTTP errors, blocked/empty pages)
 * surface as ProviderError so the discovery source can degrade honestly
 * instead of inventing results.
 */

import { ProviderError } from '../errors.js';
import type {
  WebSearchOptions,
  WebSearchProvider,
  WebSearchResult,
} from '../contracts/web-search.js';

const DEFAULT_SEARCH_URL = 'https://html.duckduckgo.com/html/';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESULTS = 10;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export interface DuckDuckGoSearchProviderConfig {
  /** Override the search endpoint (tests, mirrors). */
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface ParsedResult {
  url: string;
  title: string | null;
  snippet: string | null;
}

export class DuckDuckGoSearchProvider implements WebSearchProvider {
  readonly name = 'duckduckgo';
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: DuckDuckGoSearchProviderConfig = {}) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_SEARCH_URL).trim().replace(/\/+$/, '') + '/';
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? ((...args) => fetch(...args));
  }

  async search(query: string, options?: WebSearchOptions): Promise<WebSearchResult[]> {
    if (query.trim() === '') {
      return [];
    }
    const maxResults = options?.maxResults ?? DEFAULT_MAX_RESULTS;
    const url = new URL(this.baseUrl);
    url.searchParams.set('q', query);

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ru,en;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(options?.timeoutMs ?? this.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new ProviderError(
        this.name,
        'search',
        timedOut ? 'TIMEOUT' : 'NETWORK',
        timedOut
          ? `Web search timed out after ${options?.timeoutMs ?? this.timeoutMs}ms`
          : 'Web search network error',
        { cause: error },
      );
    }

    if (!response.ok) {
      if (response.status === 429 || response.status === 202) {
        throw new ProviderError(
          this.name,
          'search',
          'RATE_LIMIT',
          `Web search engine rate-limited the request (HTTP ${response.status})`,
        );
      }
      throw new ProviderError(
        this.name,
        'search',
        'PLATFORM',
        `Web search engine responded with HTTP ${response.status}`,
      );
    }

    const html = await response.text();
    const results = parseResults(html, this.name);
    return results.slice(0, Math.max(1, maxResults));
  }
}

/**
 * Parses DuckDuckGo HTML result blocks. Links are wrapped as
 * //duckduckgo.com/l/?uddg=<encoded-url>&rut=… — the real target is decoded.
 */
export function parseResults(html: string, source: string): WebSearchResult[] {
  const blocks = html.split(/<div class="result[^"]*"/);
  blocks.shift();
  const results: ParsedResult[] = [];
  for (const block of blocks) {
    if (results.length >= 50) break;
    const titleMatch = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(
      block,
    );
    if (titleMatch === null) continue;
    const rawHref = decodeHtml(titleMatch[1] ?? '');
    const url = unwrapDuckDuckGoUrl(rawHref);
    if (!isHttpUrl(url)) continue;
    const title = stripTags(decodeHtml(titleMatch[2] ?? '')).trim();
    if (title === '') continue;
    const snippetMatch = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const snippet =
      snippetMatch === null ? null : stripTags(decodeHtml(snippetMatch[1] ?? '')).trim();
    results.push({ url, title, snippet: snippet === '' ? null : snippet });
  }

  const seen = new Set<string>();
  const deduped: WebSearchResult[] = [];
  for (const result of results) {
    const normalized = normalizeUrlForDedupe(result.url);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push({
      url: result.url,
      title: result.title,
      snippet: result.snippet,
      domain: domainOf(result.url),
      source,
    });
  }
  return deduped;
}

/** DuckDuckGo wraps result links: /l/?uddg=<url-encoded-target>&rut=… */
function unwrapDuckDuckGoUrl(href: string): string {
  // Real DDG HTML serves protocol-relative hrefs (//duckduckgo.com/l/?…).
  const absolute = href.startsWith('//') ? `https:${href}` : href;
  try {
    const parsed = new URL(absolute);
    if (parsed.hostname.endsWith('duckduckgo.com') && parsed.pathname.startsWith('/l/')) {
      const target = parsed.searchParams.get('uddg');
      if (target !== null && target !== '') return target;
    }
  } catch {
    return href;
  }
  return absolute;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeUrlForDedupe(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

export function domainOf(value: string | null): string | null {
  if (value === null) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
