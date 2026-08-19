/**
 * OpenCode Go provider errors. Messages never contain credentials — the API
 * key is not part of any error, log line or response payload.
 */

export const defaultOpenCodeBaseUrl = 'https://opencode.ai/zen/go/v1';

export class OpenCodeModelConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenCodeModelConfigError';
  }
}

export class OpenCodeProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenCodeProviderUnavailableError';
  }
}

export class OpenCodeProviderAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenCodeProviderAuthError';
  }
}

export class OpenCodeProviderRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenCodeProviderRateLimitError';
  }
}
