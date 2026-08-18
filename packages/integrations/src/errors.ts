/**
 * Explicit failure categories for external provider calls (ARCHITECTURE.md
 * section 11: timeouts, retries where safe, explicit failure categories).
 */
export type ProviderErrorCategory =
  'TIMEOUT' | 'NETWORK' | 'AUTH' | 'VALIDATION' | 'RATE_LIMIT' | 'PLATFORM' | 'UNKNOWN';

export class ProviderError extends Error {
  constructor(
    readonly providerName: string,
    readonly operation: string,
    readonly category: ProviderErrorCategory,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ProviderError';
  }
}

export class ProviderNotFoundError extends Error {
  constructor(readonly providerId: string) {
    super(`Provider with id "${providerId}" is not registered`);
    this.name = 'ProviderNotFoundError';
  }
}

/**
 * Raised when a provider record exists but is not usable in the current
 * environment (e.g. a MOCK provider in a production composition).
 */
export class ProviderUnavailableError extends Error {
  constructor(
    readonly providerId: string,
    readonly reason: string,
  ) {
    super(`Provider with id "${providerId}" is unavailable: ${reason}`);
    this.name = 'ProviderUnavailableError';
  }
}
