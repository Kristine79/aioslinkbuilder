/**
 * Search-capable AI provider types.
 *
 * A search-capable AI provider (e.g. perplexity/* on OpenRouter) performs real
 * web search as part of the LLM inference and returns the sources it actually
 * used as structured citations (message.annotations[].url_citation). This is
 * the *only* bridge between an AI endpoint and the existing WebSearchProvider
 * port — plain LLM text is never treated as discovered sites.
 */

/** A real source cited by a search-capable AI provider. */
export interface AiCitation {
  url: string;
  title: string | null;
  startIndex: number | null;
  endIndex: number | null;
}

/**
 * Declared capabilities of an AI endpoint.
 *
 * Capabilities are NOT inferred from a model name. They are declared by the
 * operator (AI_SEARCH_CAPABILITIES) and are verified at runtime: a provider
 * that declares web search but returns no citations fails loudly instead of
 * silently degrading discovery.
 */
export interface AiProviderCapabilities {
  supportsWebSearch: boolean;
  supportsCitations: boolean;
  supportsStructuredOutput: boolean;
  supportsUsage: boolean;
}

export const NO_AI_CAPABILITIES: AiProviderCapabilities = {
  supportsWebSearch: false,
  supportsCitations: false,
  supportsStructuredOutput: false,
  supportsUsage: false,
};

export interface AiSearchUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiSearchChatResult {
  content: string;
  citations: AiCitation[];
  usage: AiSearchUsage | null;
  model: string;
}

/** Error categories surfaced across search-capable AI calls. */
export type AiSearchErrorCategory =
  'timeout' | 'network' | 'auth' | 'rate-limit' | 'server' | 'validation' | 'response';
