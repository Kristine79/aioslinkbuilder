import type { CapabilitySet } from './capabilities.js';
import { supportsCapability } from './capabilities.js';
import type { PlacementProvider } from './entities/placement-provider.js';
import type { PlacementMethod } from './enums/placement-method.js';
import type { PlacementType } from './enums/placement-type.js';
import type { ProviderType } from './enums/provider-type.js';
import { isOutreachPlacementType } from './workflow.js';

/**
 * Capabilities required to execute a placement automatically through a
 * provider: the provider must be able to submit the placement and later
 * verify the expected result.
 */
export const EXECUTION_REQUIRED_CAPABILITIES = [
  'CREATE',
  'VERIFY',
] as const satisfies CapabilitySet;

/**
 * Provider preference order for automatic execution. API integrations are
 * preferred over mocks and browser automation; manual providers are never
 * selected for automatic execution (they are used as a fallback method only).
 */
const PROVIDER_TYPE_PRIORITY: readonly ProviderType[] = ['API', 'MOCK', 'BROWSER', 'MANUAL'];

export interface ProviderAlignment {
  provider: PlacementProvider | null;
  method: PlacementMethod;
}

export function providerSupportsAll(provider: PlacementProvider, required: CapabilitySet): boolean {
  return required.every((capability) => supportsCapability(provider.capabilities, capability));
}

/**
 * Deterministically selects the best provider for automatic execution.
 *
 * A candidate must declare every required capability and have its
 * capabilities verified (PRD: "Never claim an API capability unless it has
 * been verified"). Among candidates, providers are ordered by provider type
 * priority and then by name for stability. Returns null when no provider is
 * fit for automatic execution.
 */
export function selectBestProvider(
  providers: readonly PlacementProvider[],
  required: CapabilitySet,
): PlacementProvider | null {
  const candidates = providers.filter(
    (provider) => provider.capabilitiesVerified && providerSupportsAll(provider, required),
  );
  if (candidates.length === 0) {
    return null;
  }
  return [...candidates].sort(compareProviders)[0] ?? null;
}

function compareProviders(a: PlacementProvider, b: PlacementProvider): number {
  const priorityDelta = providerPriority(a.providerType) - providerPriority(b.providerType);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }
  return a.name.localeCompare(b.name);
}

function providerPriority(providerType: ProviderType): number {
  const index = PROVIDER_TYPE_PRIORITY.indexOf(providerType);
  return index === -1 ? PROVIDER_TYPE_PRIORITY.length : index;
}

/**
 * Maps a provider type to the placement execution method it represents.
 *
 * A MOCK provider simulates the API submission flow; the provider record
 * (providerType MOCK, capabilitiesVerified) keeps the simulated nature
 * explicit — the method mapping alone never claims a real API exists.
 */
export function derivePlacementMethod(provider: PlacementProvider | null): PlacementMethod {
  if (provider === null) {
    return 'UNKNOWN';
  }
  switch (provider.providerType) {
    case 'API':
      return 'API';
    case 'MOCK':
      return 'API';
    case 'BROWSER':
      return 'BROWSER';
    case 'MANUAL':
      return 'MANUAL';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Placement method for a classification result. Outreach-driven placement
 * types (link insert, guest post, resource/partner pages) are executed via
 * human outreach regardless of provider availability — no API or browser
 * provider is required for the outreach part of the workflow.
 */
export function derivePlacementMethodForType(
  placementType: PlacementType,
  alignment: ProviderAlignment,
): PlacementMethod {
  if (isOutreachPlacementType(placementType)) {
    return 'OUTREACH';
  }
  return alignment.method;
}

/**
 * Derives the provider alignment for a platform given the required
 * capabilities.
 *
 * 1. Automatic execution: best verified provider that supports every
 *    required capability.
 * 2. Manual fallback: a verified MANUAL provider when automatic execution is
 *    not possible (the human executes the placement outside the app).
 * 3. Otherwise no alignment; the method stays UNKNOWN and unsupported
 *    capabilities stay explicit.
 */
export function deriveProviderAlignment(
  providers: readonly PlacementProvider[],
  required: CapabilitySet = EXECUTION_REQUIRED_CAPABILITIES,
): ProviderAlignment {
  const automatic = selectBestProvider(providers, required);
  if (automatic !== null) {
    return { provider: automatic, method: derivePlacementMethod(automatic) };
  }
  const manual = providers.find(
    (provider) => provider.providerType === 'MANUAL' && provider.capabilitiesVerified,
  );
  if (manual !== undefined) {
    return { provider: manual, method: derivePlacementMethod(manual) };
  }
  return { provider: null, method: 'UNKNOWN' };
}
