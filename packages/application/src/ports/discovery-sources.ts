/**
 * Port for platform discovery sources.
 *
 * A discovery source answers "which platforms could be relevant for this
 * company" — the seeded catalog is the first implementation, API-based and
 * AI/web-research sources can be added later without changing domain or
 * application logic. Sources that identify a brand-new site must persist it
 * in the platform catalog first and return its platformId; candidates
 * without a known platformId are ignored by the discovery use case for now.
 */
export interface DiscoverySourceInput {
  companyName: string;
  geography: string[];
  goals: string[];
}

export interface DiscoveryCandidate {
  /** Catalog platform id; null when the platform is not yet registered. */
  platformId: string | null;
  name: string;
  url: string | null;
  country: string | null;
  /** Placement category code the candidate belongs to, if known. */
  categoryCode: string | null;
  notes: string | null;
}

export interface DiscoverySourceResult {
  candidates: DiscoveryCandidate[];
}

export interface PlatformDiscoverySource {
  readonly name: string;
  discover(input: DiscoverySourceInput): Promise<DiscoverySourceResult>;
}
