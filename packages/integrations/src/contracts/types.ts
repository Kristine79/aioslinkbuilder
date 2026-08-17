import type {
  CapabilitySet,
  PlacementType,
  ProviderCapability,
  ProviderType,
} from '@aios/domain';

export interface DiscoverInput {
  companyName: string;
  geography: string[];
  categoryCode: string | null;
}

export interface DiscoveredPlatform {
  platformName: string;
  platformUrl: string | null;
  country: string | null;
  categoryCode: string | null;
  relevanceNotes: string | null;
}

export interface DiscoverResult {
  opportunities: DiscoveredPlatform[];
}

export interface ValidateInput {
  platformUrl: string;
  company: {
    name: string;
    website: string;
  };
}

export interface ValidateResult {
  valid: boolean;
  reason: string | null;
  observedCapabilities: ProviderCapability[];
}

export interface CreateInput {
  opportunityId: string;
  placementType: PlacementType;
  companyProfile: {
    name: string;
    description: string | null;
    website: string | null;
  };
}

export interface CreateResult {
  externalId: string;
  status: string;
  liveUrl: string | null;
}

export interface UpdateInput {
  externalId: string;
  fields: Readonly<Record<string, unknown>>;
}

export interface UpdateResult {
  status: string;
}

export interface StatusInput {
  externalId: string;
}

export interface StatusResult {
  status: string;
  liveUrl: string | null;
  publishedAt: string | null;
}

export interface VerifyInput {
  externalId: string;
  expected: {
    companyName: string;
    website: string | null;
    expectedBacklink: string | null;
  };
}

export interface VerifyResult {
  verified: boolean;
  matchedCompanyName: boolean;
  matchedWebsite: boolean;
  foundBacklink: boolean;
  liveUrl: string | null;
  failureReason: string | null;
}

export interface ProviderDescriptor {
  providerType: ProviderType;
  capabilities: CapabilitySet;
}