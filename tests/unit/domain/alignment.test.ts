import { describe, expect, it } from 'vitest';

import {
  EXECUTION_REQUIRED_CAPABILITIES,
  derivePlacementMethod,
  deriveProviderAlignment,
  selectBestProvider,
} from '@aios/domain';
import type { PlacementProvider } from '@aios/domain';

function provider(overrides: Partial<PlacementProvider>): PlacementProvider {
  return {
    id: 'provider-x',
    platformId: 'platform-x',
    name: 'Provider X',
    providerType: 'API',
    capabilities: [...EXECUTION_REQUIRED_CAPABILITIES],
    capabilitiesVerified: true,
    notes: null,
    ...overrides,
  };
}

describe('selectBestProvider', () => {
  it('returns null when no provider supports every required capability', () => {
    const providers = [provider({ capabilities: ['CREATE'] })];
    expect(selectBestProvider(providers, EXECUTION_REQUIRED_CAPABILITIES)).toBeNull();
  });

  it('ignores providers whose capabilities are not verified', () => {
    const providers = [
      provider({
        id: 'unverified',
        capabilities: [...EXECUTION_REQUIRED_CAPABILITIES],
        capabilitiesVerified: false,
      }),
    ];
    expect(selectBestProvider(providers, EXECUTION_REQUIRED_CAPABILITIES)).toBeNull();
  });

  it('prefers API providers over MOCK, BROWSER and MANUAL', () => {
    const providers = [
      provider({ id: 'manual', providerType: 'MANUAL', capabilities: ['CREATE', 'VERIFY'] }),
      provider({ id: 'browser', providerType: 'BROWSER' }),
      provider({ id: 'mock', providerType: 'MOCK' }),
      provider({ id: 'api', providerType: 'API' }),
    ];
    expect(selectBestProvider(providers, EXECUTION_REQUIRED_CAPABILITIES)?.id).toBe('api');
  });

  it('prefers MOCK over BROWSER and MANUAL when no API provider exists', () => {
    const providers = [
      provider({ id: 'manual', providerType: 'MANUAL' }),
      provider({ id: 'browser', providerType: 'BROWSER' }),
      provider({ id: 'mock', providerType: 'MOCK' }),
    ];
    expect(selectBestProvider(providers, EXECUTION_REQUIRED_CAPABILITIES)?.id).toBe('mock');
  });

  it('breaks ties by name for stability', () => {
    const providers = [provider({ id: 'b', name: 'Beta' }), provider({ id: 'a', name: 'Alpha' })];
    expect(selectBestProvider(providers, EXECUTION_REQUIRED_CAPABILITIES)?.id).toBe('a');
  });

  it('returns null with a manual-only provider because manual lacks CREATE', () => {
    const providers = [
      provider({ id: 'manual', providerType: 'MANUAL', capabilities: ['VERIFY'] }),
    ];
    expect(selectBestProvider(providers, EXECUTION_REQUIRED_CAPABILITIES)).toBeNull();
  });
});

describe('derivePlacementMethod', () => {
  it('maps API to API', () => {
    expect(derivePlacementMethod(provider({ providerType: 'API' }))).toBe('API');
  });

  it('maps MOCK to API because the mock simulates the API submission flow', () => {
    expect(derivePlacementMethod(provider({ providerType: 'MOCK' }))).toBe('API');
  });

  it('maps BROWSER to BROWSER', () => {
    expect(derivePlacementMethod(provider({ providerType: 'BROWSER' }))).toBe('BROWSER');
  });

  it('maps MANUAL to MANUAL', () => {
    expect(derivePlacementMethod(provider({ providerType: 'MANUAL' }))).toBe('MANUAL');
  });

  it('maps null to UNKNOWN', () => {
    expect(derivePlacementMethod(null)).toBe('UNKNOWN');
  });
});

describe('deriveProviderAlignment', () => {
  it('selects the best automatic provider when one exists', () => {
    const providers = [
      provider({ id: 'manual', providerType: 'MANUAL', capabilities: ['VERIFY'] }),
      provider({ id: 'mock', providerType: 'MOCK' }),
    ];
    const alignment = deriveProviderAlignment(providers);
    expect(alignment.provider?.id).toBe('mock');
    expect(alignment.method).toBe('API');
  });

  it('falls back to a verified MANUAL provider when automatic execution is impossible', () => {
    const providers = [
      provider({ id: 'manual', providerType: 'MANUAL', capabilities: ['VERIFY'] }),
    ];
    const alignment = deriveProviderAlignment(providers);
    expect(alignment.provider?.id).toBe('manual');
    expect(alignment.method).toBe('MANUAL');
  });

  it('does not fall back to an unverified manual provider', () => {
    const providers = [
      provider({
        id: 'manual',
        providerType: 'MANUAL',
        capabilities: ['VERIFY'],
        capabilitiesVerified: false,
      }),
    ];
    const alignment = deriveProviderAlignment(providers);
    expect(alignment.provider).toBeNull();
    expect(alignment.method).toBe('UNKNOWN');
  });

  it('returns UNKNOWN when no provider is available', () => {
    const alignment = deriveProviderAlignment([]);
    expect(alignment.provider).toBeNull();
    expect(alignment.method).toBe('UNKNOWN');
  });
});
