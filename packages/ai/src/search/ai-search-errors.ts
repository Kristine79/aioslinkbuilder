/**
 * AISearchClient errors. Messages never contain credentials — the API key is
 * not part of any error message, log line or response payload.
 */

import type { AiSearchErrorCategory } from './types.js';

export class AISearchConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AISearchConfigError';
  }
}

export class AISearchClientError extends Error {
  constructor(
    readonly category: AiSearchErrorCategory,
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'AISearchClientError';
  }
}

/** Raised when a web-search request returned no citations at all. */
export class AISearchNoCitationsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AISearchNoCitationsError';
  }
}
