/**
 * Real page analysis provider (MVP crawler-lite): lightweight HTTP fetch +
 * HTML parsing. Measured signals (title, canonical, description, headings,
 * indexation from robots) carry status MEASURED with source "http"; anything
 * that cannot be measured stays UNKNOWN — never synthetic.
 *
 * Handles timeouts, redirects, HTTP errors, non-HTML content and huge pages
 * (body capped at 12k chars). When the page cannot be fetched, returns an
 * UNKNOWN page analysis instead of inventing data (the AI page analysis
 * remains available for AI_ESTIMATED signals).
 */

import type { PageAnalysis } from '@aios/domain';
import { unknownDatum } from '@aios/domain';

import { guessPageType, indexationFromHeaders, parseHtmlDocument } from './html.js';

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 512 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export interface HttpPageAnalysisProviderConfig {
  timeoutMs?: number;
  maxRedirects?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Implements the PageAnalysisProvider port (application layer) structurally:
 * the integrations package must not depend on the application package.
 */
export class HttpPageAnalysisProvider {
  readonly name = 'http-page-analysis';
  private readonly timeoutMs: number;
  private readonly maxRedirects: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: HttpPageAnalysisProviderConfig = {}) {
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRedirects = config.maxRedirects ?? MAX_REDIRECTS;
    this.fetchImpl = config.fetchImpl ?? ((...args) => fetch(...args));
  }

  async analyzePage(input: { platformName: string; url: string | null }): Promise<PageAnalysis> {
    const url = normalizeUrl(input.url);
    if (url === null) {
      return unmeasured(input.platformName);
    }

    let current = url;
    let redirects = 0;
    while (true) {
      let response: Response;
      try {
        response = await this.fetchImpl(current, {
          method: 'GET',
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ru,en;q=0.8',
          },
          redirect: 'manual',
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch {
        break; // timeout / network error → UNKNOWN
      }

      if (isRedirect(response.status)) {
        const location = response.headers.get('location');
        const next = location === null ? null : new URL(location, current).toString();
        redirects += 1;
        if (next === null || redirects > this.maxRedirects) {
          break;
        }
        current = next;
        continue;
      }

      if (response.status !== 200) {
        break; // HTTP error → UNKNOWN
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (
        !contentType.toLowerCase().includes('text/html') &&
        !contentType.toLowerCase().includes('application/xhtml')
      ) {
        break; // not an HTML page → UNKNOWN
      }

      const isTooLarge =
        (response.headers.get('content-length') ?? '0') !== '0' &&
        Number(response.headers.get('content-length')) > MAX_BODY_BYTES;
      if (isTooLarge) {
        break;
      }
      let body: string;
      try {
        const buffer = await response.arrayBuffer();
        body = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, MAX_BODY_BYTES));
      } catch {
        break;
      }

      const parsed = parseHtmlDocument(body);
      const targetDomain = new URL(current).hostname.replace(/^www\./, '').toLowerCase();
      const indexation =
        parsed.robots === 'UNKNOWN' ? indexationFromHeaders(response.headers) : parsed.robots;
      return {
        targetDomain,
        targetPage: parsed.canonical ?? current,
        pageTitle: parsed.title ?? parsed.headings[0] ?? null,
        pageType: guessPageType(parsed),
        topicalRelevance: unknownDatum<number>(),
        linkInsertSuitability: unknownDatum<number>(),
        indexation: {
          value: indexation,
          source: 'http',
          status: 'MEASURED',
          confidence: 100,
          measuredAt: new Date().toISOString(),
        },
        traffic: unknownDatum<number>(),
        outboundLinkSignals: {
          value: {
            total: parsed.outboundLinks.total,
            external: parsed.outboundLinks.external,
            dofollow: null,
          },
          source: 'http',
          status: 'MEASURED',
          confidence: 100,
          measuredAt: new Date().toISOString(),
        },
        suggestedPlacementLocation: null,
        summary: parsed.text === '' ? null : parsed.text.slice(0, 400),
        analyzedAt: new Date().toISOString(),
      };
    }

    return unmeasured(input.platformName);
  }
}

function normalizeUrl(url: string | null): string | null {
  if (url === null) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function unmeasured(platformName: string): PageAnalysis {
  return {
    targetDomain: platformName,
    targetPage: null,
    pageTitle: null,
    pageType: 'UNKNOWN',
    topicalRelevance: unknownDatum<number>(),
    linkInsertSuitability: unknownDatum<number>(),
    indexation: unknownDatum(),
    traffic: unknownDatum<number>(),
    outboundLinkSignals: unknownDatum(),
    suggestedPlacementLocation: null,
    summary: null,
    analyzedAt: new Date().toISOString(),
  };
}
