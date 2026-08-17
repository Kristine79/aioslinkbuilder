import type { CapabilitySet, ProviderType } from '@aios/domain';
import type {
  CreateInput,
  CreateResult,
  DiscoverInput,
  DiscoverResult,
  StatusInput,
  StatusResult,
  UpdateInput,
  UpdateResult,
  ValidateInput,
  ValidateResult,
  VerifyInput,
  VerifyResult,
} from './types.js';

/**
 * Contract implemented by every placement platform integration
 * (API, browser, manual or mock). See ARCHITECTURE.md section 6.
 *
 * A provider does not have to support every capability. Capabilities are
 * declared on the provider record and the application layer must check them
 * with requireCapability before calling a method; implementations must also
 * raise UnsupportedCapabilityError if a method is invoked without support.
 */
export interface PlacementProvider {
  readonly providerType: ProviderType;
  readonly capabilities: CapabilitySet;
  discover(input: DiscoverInput): Promise<DiscoverResult>;
  validate(input: ValidateInput): Promise<ValidateResult>;
  create(input: CreateInput): Promise<CreateResult>;
  update(input: UpdateInput): Promise<UpdateResult>;
  getStatus(input: StatusInput): Promise<StatusResult>;
  verify(input: VerifyInput): Promise<VerifyResult>;
}