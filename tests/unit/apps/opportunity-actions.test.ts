/**
 * Presentation gate tests: `opportunityActions` must never offer `execute`
 * for an opportunity whose platform has no provider capable of CREATE+VERIFY
 * resolvable in the current environment (real web-discovered platforms in
 * production, ADR-015). When automatic execution is impossible, the platform
 * stays a valid manual target: `requestManual` is offered instead of a dead
 * end. The domain layer remains the real guard (NoProviderAvailableError) —
 * this only keeps the UI from leading the user into a guaranteed 422.
 */

import { describe, expect, it } from 'vitest';

import type { PlacementOpportunity, PlacementProvider } from '@aios/domain';
import { EXECUTION_REQUIRED_CAPABILITIES, selectBestProvider } from '@aios/domain';
import { opportunityActions, type OpportunityAction } from '@aios/api';

const BASE: PlacementOpportunity = {
  id: 'opp-1',
  campaignId: 'cmp-1',
  platformId: 'platform-ws-impmebel-ru-7quq6g',
  categoryId: null,
  placementType: 'PRODUCT_LISTING',
  relevance: null,
  score: null,
  scoreBreakdown: null,
  recommendation: null,
  whyRecommended: null,
  placementMethod: 'UNKNOWN',
  providerCapabilities: [],
  status: 'SELECTED',
  metadata: null,
  createdAt: new Date('2026-08-20T00:00:00.000Z'),
  updatedAt: new Date('2026-08-20T00:00:00.000Z'),
};

function provider(
  id: string,
  platformId: string,
  providerType: 'API' | 'BROWSER' | 'MANUAL' | 'MOCK',
  capabilities: PlacementProvider['capabilities'],
  capabilitiesVerified = true,
): PlacementProvider {
  return {
    id,
    platformId,
    name: `${id} ${providerType}`,
    providerType,
    capabilities: [...capabilities],
    capabilitiesVerified,
    notes: null,
  };
}

/** Builds a context whose provider list reflects the live registry policy. */
function contextFor(
  providers: PlacementProvider[],
): { envProviders: readonly PlacementProvider[] } {
  return { envProviders: providers };
}

function withCapabilities(
  capabilities: PlacementOpportunity['providerCapabilities'],
): PlacementOpportunity {
  return { ...BASE, providerCapabilities: capabilities };
}

describe('opportunityActions — execute gate (presentation, live registry)', () => {
  const fullProvider = provider(
    'provider-auto',
    BASE.platformId,
    'MOCK',
    EXECUTION_REQUIRED_CAPABILITIES,
  );
  const verifyOnlyProvider = provider('provider-verify', BASE.platformId, 'MANUAL', ['VERIFY']);

  it('offers execute for a SELECTED platform with a CREATE+VERIFY provider', () => {
    const opportunity = withCapabilities(['CREATE', 'VERIFY']);
    const context = contextFor([fullProvider]);
    expect(opportunityActions(opportunity, undefined, context)).toEqual(['execute'] as OpportunityAction[]);
  });

  it('does not offer execute for a SELECTED web platform without a provider; offers manual instead', () => {
    const opportunity = withCapabilities([]);
    const context = contextFor([]);
    const actions = opportunityActions(opportunity, undefined, context);
    expect(actions).not.toContain('execute');
    expect(actions).toContain('requestManual');
  });

  it('does not offer execute when the only provider record is excluded by policy (e.g. MOCK denied)', () => {
    // The registry provider list already excludes MOCKs (ADR-015): the gate
    // must not resolve the raw recorded capabilities instead.
    const opportunity = withCapabilities(['CREATE', 'VERIFY']);
    const context = contextFor([]);
    const actions = opportunityActions(opportunity, undefined, context);
    expect(actions).not.toContain('execute');
    expect(actions).toContain('requestManual');
  });

  it('does not offer execute without VERIFY (CREATE only), manual remains the fallback', () => {
    const opportunity = withCapabilities(['CREATE']);
    const context = contextFor([provider('provider-no-verify', BASE.platformId, 'API', ['CREATE'])]);
    const actions = opportunityActions(opportunity, undefined, context);
    expect(actions).not.toContain('execute');
    expect(actions).toContain('requestManual');
  });

  it('keeps requestManual for MANUAL method even without auto-execution', () => {
    const opportunity = {
      ...BASE,
      placementMethod: 'MANUAL' as const,
      providerCapabilities: [] as const,
    };
    const context = contextFor([verifyOnlyProvider]);
    expect(opportunityActions(opportunity, undefined, context)).toEqual(['requestManual'] as OpportunityAction[]);
  });

  it('offers execute alongside requestManual for MANUAL method with CREATE+VERIFY', () => {
    const opportunity = {
      ...BASE,
      placementMethod: 'MANUAL' as const,
      providerCapabilities: ['CREATE', 'VERIFY'] as const,
    };
    const context = contextFor([fullProvider]);
    expect(opportunityActions(opportunity, undefined, context)).toEqual([
      'requestManual',
      'execute',
    ] as OpportunityAction[]);
  });

  it('never offers execute for OUTREACH method before the negotiation is agreed', () => {
    const opportunity = {
      ...BASE,
      placementMethod: 'OUTREACH' as const,
      providerCapabilities: ['CREATE', 'VERIFY'] as const,
    };
    const context = contextFor([fullProvider]);
    expect(opportunityActions(opportunity, undefined, context)).toEqual([] as OpportunityAction[]);
  });
});

describe('opportunityActions — READY retry', () => {
  const fullProvider = provider(
    'provider-auto',
    BASE.platformId,
    'MOCK',
    EXECUTION_REQUIRED_CAPABILITIES,
  );

  it('offers execute for a retry while the automatic provider is still resolvable', () => {
    const opportunity = {
      ...BASE,
      status: 'READY' as const,
      providerCapabilities: ['CREATE', 'VERIFY'] as const,
    };
    const context = contextFor([fullProvider]);
    expect(opportunityActions(opportunity, undefined, context)).toEqual(['execute'] as OpportunityAction[]);
  });

  it('does not offer execute for a retry when the automatic provider is no longer resolvable', () => {
    const opportunity = {
      ...BASE,
      status: 'READY' as const,
      providerCapabilities: ['CREATE', 'VERIFY'] as const,
    };
    const context = contextFor([]);
    const actions = opportunityActions(opportunity, undefined, context);
    expect(actions).not.toContain('execute');
    expect(actions).toEqual([] as OpportunityAction[]);
  });

  it('falls back to recorded capabilities when no context is supplied (backwards compatible)', () => {
    const opportunity = withCapabilities([]);
    expect(opportunityActions(opportunity)).toEqual(['requestManual'] as OpportunityAction[]);
  });
});

describe('canExecuteAutomatically helper follows selectBestProvider semantics', () => {
  it('requires capabilitiesVerified, otherwise the platform cannot run automatically', () => {
    const unverified = provider(
      'provider-unverified',
      BASE.platformId,
      'MOCK',
      EXECUTION_REQUIRED_CAPABILITIES,
      false,
    );
    const selected = selectBestProvider([unverified], EXECUTION_REQUIRED_CAPABILITIES);
    expect(selected).toBeNull();
    const context = contextFor([unverified]);
    const actions = opportunityActions(BASE, undefined, context);
    expect(actions).not.toContain('execute');
    expect(actions).toContain('requestManual');
  });
});