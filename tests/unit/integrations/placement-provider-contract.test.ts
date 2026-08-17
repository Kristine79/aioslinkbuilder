import { describe, expect, it } from 'vitest';

import { UnsupportedCapabilityError, requireCapability } from '@aios/domain';
import type {
  CreateInput,
  CreateResult,
  DiscoverInput,
  DiscoverResult,
  PlacementProvider,
  ProviderDescriptor,
  StatusInput,
  StatusResult,
  UpdateInput,
  UpdateResult,
  ValidateInput,
  ValidateResult,
  VerifyInput,
  VerifyResult,
} from '@aios/integrations';

/**
 * Verifies the provider contract contractually: a provider declares its
 * capabilities and the application layer must gate calls through the domain
 * capability check. Implementations must also reject unsupported calls.
 */
describe('placement provider contract', () => {
  const discoverOnlyProvider: ProviderDescriptor = {
    providerType: 'MOCK',
    capabilities: ['DISCOVER'],
  };

  class DiscoverOnlyMock implements PlacementProvider {
    readonly providerType = 'MOCK' as const;
    readonly capabilities: readonly 'DISCOVER'[] = ['DISCOVER'];

    discover(_input: DiscoverInput): Promise<DiscoverResult> {
      return Promise.resolve({ opportunities: [] });
    }

    validate(_input: ValidateInput): Promise<ValidateResult> {
      return Promise.reject(new UnsupportedCapabilityError('VALIDATE', 'discover-only-mock'));
    }

    create(_input: CreateInput): Promise<CreateResult> {
      return Promise.reject(new UnsupportedCapabilityError('CREATE', 'discover-only-mock'));
    }

    update(_input: UpdateInput): Promise<UpdateResult> {
      return Promise.reject(new UnsupportedCapabilityError('UPDATE', 'discover-only-mock'));
    }

    getStatus(_input: StatusInput): Promise<StatusResult> {
      return Promise.reject(new UnsupportedCapabilityError('GET_STATUS', 'discover-only-mock'));
    }

    verify(_input: VerifyInput): Promise<VerifyResult> {
      return Promise.reject(new UnsupportedCapabilityError('VERIFY', 'discover-only-mock'));
    }
  }

  it('declares a discover-only provider explicitly', () => {
    expect(discoverOnlyProvider.capabilities).toEqual(['DISCOVER']);
  });

  it('blocks unsupported calls via the domain capability check', () => {
    const provider = new DiscoverOnlyMock();
    expect(() => requireCapability(provider.capabilities, 'CREATE', provider.providerType)).toThrow(
      UnsupportedCapabilityError,
    );
  });

  it('implementation rejects unsupported capability calls', async () => {
    const provider = new DiscoverOnlyMock();
    await expect(provider.create({} as never)).rejects.toBeInstanceOf(UnsupportedCapabilityError);
    await expect(provider.verify({} as never)).rejects.toBeInstanceOf(UnsupportedCapabilityError);
  });

  it('supports the declared capability', async () => {
    const provider = new DiscoverOnlyMock();
    expect(() =>
      requireCapability(provider.capabilities, 'DISCOVER', 'discover-only-mock'),
    ).not.toThrow();
    await expect(
      provider.discover({ companyName: 'x', geography: [], categoryCode: null }),
    ).resolves.toEqual({
      opportunities: [],
    });
  });
});
