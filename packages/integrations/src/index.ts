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
