import type { PlacementProvider } from './contracts/placement-provider.js';
import type {
  DiscoverInput,
  DiscoverResult,
  DiscoveredPlatform,
  ValidateInput,
  ValidateResult,
  CreateInput,
  CreateResult,
  UpdateInput,
  UpdateResult,
  StatusInput,
  StatusResult,
  VerifyInput,
  VerifyResult,
  ProviderDescriptor,
} from './contracts/types.js';

export type { PlacementProvider, ProviderDescriptor };
export type {
  DiscoverInput,
  DiscoverResult,
  DiscoveredPlatform,
  ValidateInput,
  ValidateResult,
  CreateInput,
  CreateResult,
  UpdateInput,
  UpdateResult,
  StatusInput,
  StatusResult,
  VerifyInput,
  VerifyResult,
};

export { ProviderError, ProviderNotFoundError, ProviderUnavailableError } from './errors.js';
export type { ProviderErrorCategory } from './errors.js';

export { MockPlacementProvider } from './mock/mock-placement-provider.js';
export type {
  MockPlacementProviderOptions,
  MockPlacementStatus,
} from './mock/mock-placement-provider.js';
export { InMemoryPlacementProviderRegistry } from './mock/in-memory-provider-registry.js';
export type { InMemoryPlacementProviderRegistryOptions } from './mock/in-memory-provider-registry.js';

export type {
  WebSearchProvider,
  WebSearchResult,
  WebSearchOptions,
} from './contracts/web-search.js';
export { DuckDuckGoSearchProvider } from './web/duckduckgo-search.js';
export type { DuckDuckGoSearchProviderConfig } from './web/duckduckgo-search.js';
export { parseResults, domainOf } from './web/duckduckgo-search.js';
export { AISearchCitationsProvider } from './web/ai-search-provider.js';
export type { SearchCitationsPort, SearchCitation } from './contracts/ai-search.js';
export { HttpPageAnalysisProvider } from './web/http-page-analysis-provider.js';
export type { HttpPageAnalysisProviderConfig } from './web/http-page-analysis-provider.js';
export { parseHtmlDocument, guessPageType, indexationFromHeaders } from './web/html.js';
export type { ParsedPage } from './web/html.js';
