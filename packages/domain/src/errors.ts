import type { PlacementStatus } from './enums/placement-status.js';
import type { ProviderCapability } from './enums/provider-capability.js';

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {}

export class InvalidPlacementTransitionError extends DomainError {
  constructor(
    readonly from: PlacementStatus,
    readonly to: PlacementStatus,
  ) {
    super(`Invalid placement state transition: ${from} -> ${to}`);
  }
}

export class UnsupportedCapabilityError extends DomainError {
  constructor(
    readonly capability: ProviderCapability,
    readonly context: string,
  ) {
    super(`Capability ${capability} is not supported: ${context}`);
  }
}
