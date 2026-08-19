/**
 * Capability resolution for search-capable AI providers.
 *
 * Capabilities are EXPLICITLY declared by the operator via
 * AI_SEARCH_CAPABILITIES (comma-separated tokens). Unknown or unset =
 * unsupported. This deliberately avoids guessing capability from a model
 * name: a plain LLM endpoint (e.g. OpenCode Go / deepseek-v4-pro) must never
 * be treated as web-search capable just because it is configured.
 */

import type { AiProviderCapabilities } from './types.js';

export const AI_SEARCH_CAPABILITY_TOKENS = [
  'web_search',
  'citations',
  'structured_output',
  'usage',
] as const;

export type AiSearchCapabilityToken = (typeof AI_SEARCH_CAPABILITY_TOKENS)[number];

export interface AiSearchCapabilitiesConfig {
  /** Comma-separated capability tokens (AI_SEARCH_CAPABILITIES). */
  declared?: string;
}

/**
 * Parses declared capability tokens. Returns null when the operator declared
 * nothing — callers decide how to treat an undeclared provider (fail-fast for
 * discovery, plain LLM otherwise).
 */
export function parseSearchCapabilities(
  config: AiSearchCapabilitiesConfig,
): AiProviderCapabilities | null {
  const raw = (config.declared ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (raw.length === 0) return null;

  const normalized = new Set(raw);
  const has = (token: AiSearchCapabilityToken): boolean => normalized.has(token);

  return {
    supportsWebSearch: has('web_search'),
    supportsCitations: has('citations'),
    supportsStructuredOutput: has('structured_output'),
    supportsUsage: has('usage'),
  };
}
