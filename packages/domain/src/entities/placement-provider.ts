import type { ProviderCapability } from '../enums/provider-capability.js';
import type { ProviderType } from '../enums/provider-type.js';

export interface PlacementProvider {
  id: string;
  platformId: string;
  name: string;
  providerType: ProviderType;
  capabilities: readonly ProviderCapability[];
  capabilitiesVerified: boolean;
  notes: string | null;
}
