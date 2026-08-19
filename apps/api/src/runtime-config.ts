/**
 * Runtime mode configuration for the delivery API.
 *
 * Modes:
 * - AI_MODE=real        uses the OpenCode Go LLM for every AI capability;
 *   AI_MODE=demo (default) uses the deterministic ScenarioAIProvider.
 * - DISCOVERY_MODE=real uses LLM-planned queries + real web search and
 *   persists found sites into the platform catalog;
 *   DISCOVERY_MODE=demo (default) uses the synthetic scenario sources.
 * - DISCOVERY_PROVIDER selects the real web search backend when
 *   DISCOVERY_MODE=real:
 *     duckduckgo (default) — DuckDuckGo HTML search;
 *     ai-search — a search-capable AI provider (e.g. perplexity/sonar on
 *     OpenRouter) whose real citations become search results.
 * - MOCK_PROVIDERS controls whether MOCK placement providers may be bound
 *   into the delivery composition:
 *     allow — bind MOCK providers (demo / test / preview environments);
 *     deny (default) — the registry excludes MOCK providers, so automated
 *     placement execution against synthetic providers is impossible.
 *   Production must never set "allow": an unknown value fails startup
 *   instead of silently enabling mocks.
 *
 * Explicitly requesting a real mode without the required credentials is a
 * startup error — the product never silently falls back to demo data when
 * the operator asked for real integrations.
 */

import {
  DEFAULT_OPENCODE_MODEL,
  defaultOpenCodeBaseUrl,
  defaultAiSearchBaseUrl,
  defaultAiSearchModel,
  parseSearchCapabilities,
  type AiProviderCapabilities,
  type OpenCodeAIProviderConfig,
} from '@aios/ai';

export type AiMode = 'real' | 'demo';
export type DiscoveryMode = 'real' | 'demo';
export type DiscoveryProvider = 'ai-search' | 'duckduckgo';

export interface OpenCodeRuntimeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AiSearchRuntimeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  capabilities: AiProviderCapabilities;
  timeoutMs: number;
}

export interface RuntimeConfig {
  aiMode: AiMode;
  discoveryMode: DiscoveryMode;
  discoveryProvider: DiscoveryProvider;
  openCode: OpenCodeRuntimeConfig | null;
  aiSearch: AiSearchRuntimeConfig | null;
  /** MOCK placement providers may be bound into this composition (demo/test only). */
  allowMockProviders: boolean;
  /** Bounds for real web discovery (cost/latency limits for serverless). */
  discoveryLimits: DiscoveryLimits;
}

export interface DiscoveryLimits {
  maxQueries: number;
  maxResultsPerQuery: number;
  maxCandidates: number;
  concurrency: number;
}

export class RuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeConfigError';
  }
}

const DEFAULT_DISCOVERY_LIMITS: DiscoveryLimits = {
  maxQueries: 10,
  maxResultsPerQuery: 8,
  maxCandidates: 40,
  concurrency: 2,
};

export function loadRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): RuntimeConfig {
  const aiMode = parseMode(env.AI_MODE, 'AI_MODE', 'demo');
  const discoveryMode = parseMode(env.DISCOVERY_MODE, 'DISCOVERY_MODE', 'demo');
  const discoveryProvider = parseDiscoveryProvider(env.DISCOVERY_PROVIDER);
  const allowMockProviders = parseMockProviders(env.MOCK_PROVIDERS);

  const apiKey = (env.OPENCODE_API_KEY ?? '').trim();
  const wantsReal = aiMode === 'real' || discoveryMode === 'real';
  if (wantsReal && apiKey === '') {
    throw new RuntimeConfigError(
      'AI_MODE or DISCOVERY_MODE is "real" but OPENCODE_API_KEY is not set. ' +
        'Set OPENCODE_API_KEY (https://opencode.ai) or switch the mode back to "demo".',
    );
  }

  const baseUrl = (env.OPENCODE_BASE_URL ?? '').trim();
  const aiSearch = resolveAiSearchConfig(env, discoveryMode, discoveryProvider);

  return {
    aiMode,
    discoveryMode,
    discoveryProvider,
    allowMockProviders,
    openCode: wantsReal
      ? {
          apiKey,
          baseUrl: baseUrl === '' ? defaultOpenCodeBaseUrl : baseUrl,
          model: (env.OPENCODE_MODEL ?? '').trim() || DEFAULT_OPENCODE_MODEL,
        }
      : null,
    aiSearch,
    discoveryLimits: resolveDiscoveryLimits(env),
  };
}

/**
 * Resolves the search-capable AI configuration. Only loaded when the operator
 * explicitly selected DISCOVERY_PROVIDER=ai-search; missing credentials or a
 * provider that does not declare web-search capabilities are startup errors
 * (no silent fallback).
 */
function resolveAiSearchConfig(
  env: Readonly<Record<string, string | undefined>>,
  discoveryMode: DiscoveryMode,
  discoveryProvider: DiscoveryProvider,
): AiSearchRuntimeConfig | null {
  if (discoveryMode !== 'real' || discoveryProvider !== 'ai-search') {
    return null;
  }

  const apiKey = (env.AI_SEARCH_API_KEY ?? '').trim();
  if (apiKey === '') {
    throw new RuntimeConfigError(
      'DISCOVERY_PROVIDER=ai-search requires AI_SEARCH_API_KEY. ' +
        'The OpenCode Go key is a plain LLM endpoint and cannot be reused for web search; ' +
        'use a search-capable provider key (e.g. OpenRouter with perplexity/sonar).',
    );
  }

  const capabilities = parseSearchCapabilities({
    declared: env.AI_SEARCH_CAPABILITIES ?? '',
  });
  if (capabilities === null) {
    throw new RuntimeConfigError(
      'DISCOVERY_PROVIDER=ai-search requires AI_SEARCH_CAPABILITIES to declare ' +
        'the endpoint capabilities (e.g. "web_search,citations,usage"). ' +
        'Capabilities are never guessed from a model name.',
    );
  }
  if (!capabilities.supportsWebSearch || !capabilities.supportsCitations) {
    throw new RuntimeConfigError(
      'DISCOVERY_PROVIDER=ai-search requires AI_SEARCH_CAPABILITIES to include ' +
        '"web_search" and "citations"; got ' +
        `"${env.AI_SEARCH_CAPABILITIES ?? ''}". ` +
        'A provider that does not support web search cannot run discovery.',
    );
  }

  const baseUrl = (env.AI_SEARCH_BASE_URL ?? '').trim();
  const rawTimeout = Number(env.AI_SEARCH_TIMEOUT_MS ?? 45000);
  return {
    apiKey,
    baseUrl: baseUrl === '' ? defaultAiSearchBaseUrl : baseUrl,
    model: (env.AI_SEARCH_MODEL ?? '').trim() || defaultAiSearchModel,
    capabilities,
    timeoutMs: Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 45000,
  };
}

/** Builds the OpenCode client config for a validated runtime config. */
export function openCodeProviderConfig(
  config: RuntimeConfig,
  env: Readonly<Record<string, string | undefined>> = process.env,
): OpenCodeAIProviderConfig | null {
  if (config.openCode === null) return null;
  const { apiKey, baseUrl, model } = config.openCode;
  const rawTimeout = Number(env.OPENCODE_TIMEOUT_MS ?? 30000);
  return {
    apiKey,
    baseUrl,
    model,
    timeoutMs: Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 30000,
  };
}

function parseMode(
  value: string | undefined,
  name: string,
  fallback: 'real' | 'demo',
): 'real' | 'demo' {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === '') return fallback;
  if (normalized === 'real' || normalized === 'demo') return normalized;
  throw new RuntimeConfigError(
    `${name} must be "real" or "demo", got "${value}". ` +
      'Leave it unset for the deterministic demo mode.',
  );
}

function parseDiscoveryProvider(value: string | undefined): DiscoveryProvider {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === '') return 'duckduckgo';
  if (normalized === 'ai-search' || normalized === 'duckduckgo') return normalized;
  throw new RuntimeConfigError(
    `DISCOVERY_PROVIDER must be "ai-search" or "duckduckgo", got "${value}". ` +
      'Leave it unset for the DuckDuckGo backend.',
  );
}

/**
 * MOCK providers are opt-in: the default is deny, and any unrecognized value
 * fails startup instead of silently allowing synthetic providers.
 */
function parseMockProviders(value: string | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === '') return false;
  if (normalized === 'allow') return true;
  if (normalized === 'deny') return false;
  throw new RuntimeConfigError(
    `MOCK_PROVIDERS must be "allow" or "deny", got "${value}". ` +
      'Leave it unset (or set "deny") for the production-safe default.',
  );
}

function resolveDiscoveryLimits(
  env: Readonly<Record<string, string | undefined>>,
): DiscoveryLimits {
  const pick = (name: string, fallback: number): number => {
    const raw = Number(env[name] ?? '');
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
  };
  return {
    maxQueries: pick('DISCOVERY_MAX_QUERIES', DEFAULT_DISCOVERY_LIMITS.maxQueries),
    maxResultsPerQuery: pick(
      'DISCOVERY_MAX_RESULTS_PER_QUERY',
      DEFAULT_DISCOVERY_LIMITS.maxResultsPerQuery,
    ),
    maxCandidates: pick('DISCOVERY_MAX_CANDIDATES', DEFAULT_DISCOVERY_LIMITS.maxCandidates),
    concurrency: pick('DISCOVERY_CONCURRENCY', DEFAULT_DISCOVERY_LIMITS.concurrency),
  };
}
