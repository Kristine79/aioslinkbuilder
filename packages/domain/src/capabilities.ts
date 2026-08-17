import type { ProviderCapability } from './enums/provider-capability.js';
import { UnsupportedCapabilityError } from './errors.js';

export type CapabilitySet = readonly ProviderCapability[];

export function supportsCapability(
  supported: CapabilitySet,
  capability: ProviderCapability,
): boolean {
  return supported.includes(capability);
}

export function requireCapability(
  supported: CapabilitySet,
  capability: ProviderCapability,
  context: string,
): void {
  if (!supportsCapability(supported, capability)) {
    throw new UnsupportedCapabilityError(capability, context);
  }
}
