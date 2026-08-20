/**
 * Presentation gate tests: `opportunityActions` must never offer `execute`
 * for an opportunity whose platform has no provider capable of CREATE+VERIFY
 * (real web-discovered platforms in production, ADR-015). The domain layer
 * remains the real guard (NoProviderAvailableError) — this only keeps the UI
 * from leading the user into a guaranteed 422.
 */

import { describe, expect, it } from 'vitest';

import type { PlacementOpportunity } from '@aios/domain';
import { opportunityActions } from '@aios/api';

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

function withCapabilities(
  capabilities: PlacementOpportunity['providerCapabilities'],
): PlacementOpportunity {
  return { ...BASE, providerCapabilities: capabilities };
}

describe('opportunityActions — execute gate (presentation)', () => {
  it('offers execute for a SELECTED platform with a CREATE+VERIFY provider', () => {
    const opportunity = withCapabilities(['CREATE', 'VERIFY']);
    expect(opportunityActions(opportunity)).toEqual(['execute']);
  });

  it('does not offer execute for a SELECTED platform with no provider capabilities', () => {
    const opportunity = withCapabilities([]);
    expect(opportunityActions(opportunity)).toEqual([]);
  });

  it('does not offer execute without VERIFY (CREATE only)', () => {
    const opportunity = withCapabilities(['CREATE']);
    expect(opportunityActions(opportunity)).toEqual([]);
  });

  it('keeps requestManual for MANUAL method even without auto-execution', () => {
    const opportunity = {
      ...BASE,
      placementMethod: 'MANUAL' as const,
      providerCapabilities: [] as const,
    };
    expect(opportunityActions(opportunity)).toEqual(['requestManual']);
  });

  it('offers execute alongside requestManual for MANUAL method with CREATE+VERIFY', () => {
    const opportunity = {
      ...BASE,
      placementMethod: 'MANUAL' as const,
      providerCapabilities: ['CREATE', 'VERIFY'] as const,
    };
    expect(opportunityActions(opportunity)).toEqual(['requestManual', 'execute']);
  });

  it('never offers execute for OUTREACH method before the negotiation is agreed', () => {
    const opportunity = {
      ...BASE,
      placementMethod: 'OUTREACH' as const,
      providerCapabilities: ['CREATE', 'VERIFY'] as const,
    };
    expect(opportunityActions(opportunity)).toEqual([]);
  });
});

describe('opportunityActions — READY retry keeps execute', () => {
  it('offers execute when a previous placement exists and can be retried', () => {
    const opportunity = {
      ...BASE,
      status: 'READY' as const,
      providerCapabilities: ['CREATE', 'VERIFY'] as const,
    };
    expect(opportunityActions(opportunity)).toEqual(['execute']);
  });
});
