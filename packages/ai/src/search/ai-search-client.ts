/**
 * Minimal OpenAI-compatible chat completions client for search-capable AI
 * providers (e.g. perplexity/* on OpenRouter).
 *
 * This client is deliberately separate from OpenCodeClient:
 * - OpenCodeClient is a plain LLM endpoint that never returns web citations;
 * - AISearchClient is only used as the bridge to existing WebSearchProvider
 *   discovery, and its contract is "return the real citations the model
 *   actually used".
 *
 * Security: the API key is accepted only via config, never logged, never part
 * of error messages, never included in request payloads beyond the Authorization
 * header.
 *
 * Reliability: per-request timeout, one retry for 429/5xx/network/timeout. A
 * web-search request that returns zero citations is an explicit error — a
 * plain-text answer is never interpreted as discovered sites.
 */

import { extractCitations } from './citations.js';
import {
  AISearchClientError,
  AISearchConfigError,
  AISearchNoCitationsError,
} from './ai-search-errors.js';
import type { AiProviderCapabilities, AiSearchChatResult, AiCitation } from './types.js';
import { NO_AI_CAPABILITIES } from './types.js';

export const defaultAiSearchBaseUrl = 'https://openrouter.ai/api/v1';
export const defaultAiSearchModel = 'perplexity/sonar';
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 1;
const BACKOFF_MS = 800;
const DEFAULT_MAX_RESULTS = 8;

export interface AISearchClientConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  /** Declared capabilities; used to enforce that web search was requested. */
  capabilities?: AiProviderCapabilities;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface AISearchSearchOptions {
  maxResults?: number;
  timeoutMs?: number;
}

/** Prompt template: instructs the model to search and cite real sources. */
const SEARCH_SYSTEM_PROMPT =
  'You are a research assistant with live web search enabled. ' +
  'Answer the question in Russian. Always base your answer on what you find ' +
  'on the web and always attach the real sources you actually used as ' +
  'url_citation annotations. Never invent URLs. If you cannot cite sources, ' +
  'say so explicitly instead of fabricating references.';

export class AISearchClient {
  readonly providerName = 'ai-search';
  readonly model: string;
  readonly capabilities: AiProviderCapabilities;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: AISearchClientConfig) {
    if (config.apiKey.trim() === '') {
      throw new AISearchConfigError('AI_SEARCH_API_KEY is required to construct the client');
    }
    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl ?? defaultAiSearchBaseUrl).trim().replace(/\/+$/, '');
    this.model = (config.model ?? defaultAiSearchModel).trim();
    this.capabilities = config.capabilities ?? NO_AI_CAPABILITIES;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? ((...args) => fetch(...args));
  }

  /**
   * Runs a live web-search request and returns the real citations the
   * provider used. Throws AISearchNoCitationsError when a declared
   * web-search call returned no citations (plain text is never trusted as a
   * source of discovered sites).
   */
  async searchCitations(query: string, options: AISearchSearchOptions = {}): Promise<AiCitation[]> {
    if (this.model === '') {
      throw new AISearchConfigError('AI_SEARCH_MODEL is required to call the search provider');
    }
    if (!this.capabilities.supportsWebSearch || !this.capabilities.supportsCitations) {
      throw new AISearchConfigError(
        'AISearchClient cannot perform web search: AI_SEARCH_CAPABILITIES does not ' +
          'declare web_search, citations',
      );
    }
    if (query.trim() === '') {
      return [];
    }

    const maxCitations = Math.max(1, Math.min(options.maxResults ?? DEFAULT_MAX_RESULTS, 20));
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: SEARCH_SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      max_tokens: 1_200,
    };

    let lastError: AISearchClientError | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      if (attempt > 0 && lastError !== null) {
        await sleep(BACKOFF_MS);
      }
      try {
        const result = await this.completeOnce(body, options.timeoutMs ?? this.timeoutMs);
        if (result.citations.length === 0) {
          throw new AISearchNoCitationsError(
            `Search provider (${this.providerName}) returned no citations for query "${query.slice(0, 80)}"`,
          );
        }
        return result.citations.slice(0, maxCitations);
      } catch (error) {
        if (error instanceof AISearchNoCitationsError) {
          throw error;
        }
        if (!(error instanceof AISearchClientError)) {
          throw error;
        }
        if (!isRetryable(error) || attempt >= MAX_RETRIES) {
          throw error;
        }
        lastError = error;
      }
    }
    if (lastError !== null) throw lastError;
    throw new AISearchClientError('response', 'Search provider returned no response', null);
  }

  /** Single transport call returning content + citations + usage. */
  private async completeOnce(
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<AiSearchChatResult> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new AISearchClientError(
          'timeout',
          `Search provider request timed out after ${timeoutMs}ms`,
          null,
        );
      }
      throw new AISearchClientError(
        'network',
        'Search provider network error while calling chat completions',
        null,
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new AISearchClientError(
        'auth',
        'Search provider rejected the API key (HTTP 401/403) — check AI_SEARCH_API_KEY',
        response.status,
      );
    }
    if (response.status === 429) {
      throw new AISearchClientError(
        'rate-limit',
        'Search provider rate limit exceeded (429)',
        response.status,
      );
    }
    if (response.status >= 500) {
      throw new AISearchClientError(
        'server',
        `Search provider server error (HTTP ${response.status})`,
        response.status,
      );
    }
    if (response.status >= 400 && response.status < 500) {
      throw new AISearchClientError(
        'validation',
        `Search provider rejected the request (HTTP ${response.status}) — check AI_SEARCH_MODEL and the payload`,
        response.status,
      );
    }
    if (!response.ok) {
      throw new AISearchClientError(
        'response',
        `Search provider rejected the request (HTTP ${response.status})`,
        response.status,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AISearchClientError(
        'response',
        'Search provider returned malformed JSON envelope',
        response.status,
      );
    }
    const { content, citations } = extractCitations(payload);
    if (content === '') {
      throw new AISearchClientError(
        'response',
        'Search provider response had no assistant content',
        response.status,
      );
    }
    return {
      content,
      citations,
      usage: extractUsage(payload),
      model: this.model,
    };
  }
}

function extractUsage(payload: unknown): AiSearchChatResult['usage'] {
  const usage =
    payload !== null && typeof payload === 'object'
      ? ((payload as Record<string, unknown>).usage as Record<string, unknown> | undefined)
      : undefined;
  if (usage === null || typeof usage !== 'object') return null;
  const promptTokens = usage.prompt_tokens;
  const completionTokens = usage.completion_tokens;
  const totalTokens = usage.total_tokens;
  if (
    typeof promptTokens !== 'number' ||
    typeof completionTokens !== 'number' ||
    typeof totalTokens !== 'number'
  ) {
    return null;
  }
  return { promptTokens, completionTokens, totalTokens };
}

function isRetryable(error: AISearchClientError): boolean {
  return (
    error.category === 'rate-limit' ||
    error.category === 'server' ||
    error.category === 'network' ||
    error.category === 'timeout'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
