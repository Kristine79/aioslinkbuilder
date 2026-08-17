import { describe, expect, it } from 'vitest';

import {
  PROVIDER_CAPABILITIES,
  UnsupportedCapabilityError,
  requireCapability,
  supportsCapability,
} from '@aios/domain';
import type { ProviderCapability } from '@aios/domain';

describe('provider capability validation', () => {
  const fullProvider: readonly ProviderCapability[] = [...PROVIDER_CAPABILITIES];
  const discoverOnly: readonly ProviderCapability[] = ['DISCOVER'];
  const empty: readonly ProviderCapability[] = [];

  it('accepts every capability on a full provider', () => {
    for (const capability of PROVIDER_CAPABILITIES) {
      expect(supportsCapability(fullProvider, capability)).toBe(true);
      expect(() => requireCapability(fullProvider, capability, 'test')).not.toThrow();
    }
  });

  it('rejects unsupported capabilities explicitly', () => {
    for (const capability of ['VALIDATE', 'CREATE', 'UPDATE', 'GET_STATUS', 'VERIFY'] as const) {
      expect(supportsCapability(discoverOnly, capability)).toBe(false);
      expect(() => requireCapability(discoverOnly, capability, 'test')).toThrow(
        UnsupportedCapabilityError,
      );
    }
  });

  it('rejects every capability on an empty provider', () => {
    for (const capability of PROVIDER_CAPABILITIES) {
      expect(supportsCapability(empty, capability)).toBe(false);
      expect(() => requireCapability(empty, capability, 'test')).toThrow(
        UnsupportedCapabilityError,
      );
    }
  });

  it('supports a subset of capabilities', () => {
    const subset: readonly ProviderCapability[] = ['DISCOVER', 'VALIDATE', 'VERIFY'];
    expect(supportsCapability(subset, 'DISCOVER')).toBe(true);
    expect(supportsCapability(subset, 'VALIDATE')).toBe(true);
    expect(supportsCapability(subset, 'VERIFY')).toBe(true);
    expect(supportsCapability(subset, 'CREATE')).toBe(false);
    expect(supportsCapability(subset, 'UPDATE')).toBe(false);
    expect(supportsCapability(subset, 'GET_STATUS')).toBe(false);
  });

  it('reports the missing capability and context in the error', () => {
    try {
      requireCapability(discoverOnly, 'CREATE', 'provider:yandex-business');
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedCapabilityError);
      if (error instanceof UnsupportedCapabilityError) {
        expect(error.capability).toBe('CREATE');
        expect(error.context).toBe('provider:yandex-business');
        expect(error.message).toContain('CREATE');
        expect(error.message).toContain('provider:yandex-business');
      }
    }
  });
});
