import { describe, expect, it } from 'vitest';

import {
  buildPlanSummary,
  pickRecommendedToStart,
  reconcilePlanDecision,
  type PlanDecisionAiSuggestion,
  type PlanDecisionSignals,
  type PlanDecisionItem,
} from '@aios/domain';

function suggestion(overrides: Partial<PlanDecisionAiSuggestion> = {}): PlanDecisionAiSuggestion {
  return {
    recommendation: 'RECOMMENDED',
    recommendationReason: 'AI reason',
    nextAction: 'EXECUTE_AUTOMATICALLY',
    automationLevel: 'AUTOMATIC',
    riskExplanation: null,
    suggestedPlacementApproach: 'Approach',
    ...overrides,
  };
}

function signals(overrides: Partial<PlanDecisionSignals> = {}): PlanDecisionSignals {
  return {
    score: 88,
    overallScore: null,
    riskLevel: 'LOW',
    placementMethod: 'API',
    placementType: 'BUSINESS_PROFILE',
    providerAvailable: true,
    providerCapabilitiesVerified: true,
    hasIntel: true,
    strategySupportsType: true,
    ...overrides,
  };
}

describe('reconcilePlanDecision', () => {
  it('keeps a strong AI recommendation with all deterministic signals aligned', () => {
    const decision = reconcilePlanDecision(signals(), suggestion());
    expect(decision.recommendation).toBe('RECOMMENDED');
    expect(decision.nextAction).toBe('EXECUTE_AUTOMATICALLY');
    expect(decision.automationLevel).toBe('AUTOMATIC');
    expect(decision.rejectionReason).toBeNull();
    // The AI reason is preserved — AI output is interpreted, not overridden.
    expect(decision.recommendationReason).toBe('AI reason');
  });

  it('preserves the deterministic scores — the plan never rewrites them', () => {
    const decision = reconcilePlanDecision(signals({ score: 92, overallScore: 87 }), suggestion());
    expect(decision.recommendation).toBe('RECOMMENDED');
  });

  it('downgrades a RECOMMENDED mid-range score to REVIEW_REQUIRED', () => {
    const decision = reconcilePlanDecision(signals({ score: 60 }), suggestion());
    expect(decision.recommendation).toBe('REVIEW_REQUIRED');
    expect(decision.automationLevel).toBe('HUMAN_REQUIRED');
    expect(decision.nextAction).toBe('REVIEW_OPPORTUNITY');
  });

  it('rejects a weak score with the LOW_SCORE reason', () => {
    const decision = reconcilePlanDecision(signals({ score: 40 }), suggestion());
    expect(decision.recommendation).toBe('NOT_RECOMMENDED');
    expect(decision.nextAction).toBe('REJECT');
    expect(decision.rejectionReason?.kind).toBe('LOW_SCORE');
  });

  it('forces REVIEW_REQUIRED for high donor risk even when the AI recommends', () => {
    const decision = reconcilePlanDecision(signals({ riskLevel: 'HIGH' }), suggestion());
    expect(decision.recommendation).toBe('REVIEW_REQUIRED');
    expect(decision.nextAction).toBe('REVIEW_OPPORTUNITY');
    expect(decision.automationLevel).toBe('HUMAN_REQUIRED');
  });

  it('marks the item NOT_RECOMMENDED when no provider exists for an execution method', () => {
    const decision = reconcilePlanDecision(
      signals({ providerAvailable: false, placementMethod: 'API' }),
      suggestion(),
    );
    expect(decision.recommendation).toBe('NOT_RECOMMENDED');
    expect(decision.nextAction).toBe('REVIEW_PROVIDER');
    expect(decision.rejectionReason?.kind).toBe('NO_PROVIDER');
  });

  it('keeps an AI NOT_RECOMMENDED and derives the rejection reason from data', () => {
    const decision = reconcilePlanDecision(
      signals({ score: 30, riskLevel: 'HIGH' }),
      suggestion({ recommendation: 'NOT_RECOMMENDED' }),
    );
    expect(decision.recommendation).toBe('NOT_RECOMMENDED');
    expect(decision.rejectionReason?.kind).toBe('LOW_SCORE');
  });

  it('binds OUTREACH methods to PREPARE_OUTREACH with human involvement', () => {
    const decision = reconcilePlanDecision(
      signals({ placementMethod: 'OUTREACH', providerAvailable: true }),
      suggestion(),
    );
    expect(decision.recommendation).toBe('RECOMMENDED');
    expect(decision.nextAction).toBe('PREPARE_OUTREACH');
    expect(decision.automationLevel).toBe('HUMAN_REQUIRED');
  });

  it('binds MANUAL methods to REQUEST_MANUAL_PLACEMENT with human involvement', () => {
    const decision = reconcilePlanDecision(
      signals({ placementMethod: 'MANUAL', providerAvailable: true }),
      suggestion(),
    );
    expect(decision.recommendation).toBe('RECOMMENDED');
    expect(decision.nextAction).toBe('REQUEST_MANUAL_PLACEMENT');
    expect(decision.automationLevel).toBe('HUMAN_REQUIRED');
  });

  it('requires provider review for BROWSER execution when capabilities are unverified', () => {
    const decision = reconcilePlanDecision(
      signals({ placementMethod: 'BROWSER', providerCapabilitiesVerified: false }),
      suggestion(),
    );
    expect(decision.nextAction).toBe('REVIEW_PROVIDER');
    expect(decision.automationLevel).toBe('AI_ASSISTED');
  });

  it('returns INSUFFICIENT_DATA when there is no score, no intel and no risk', () => {
    const decision = reconcilePlanDecision(
      signals({
        score: null,
        overallScore: null,
        riskLevel: null,
        hasIntel: false,
        providerAvailable: false,
      }),
      suggestion({ recommendation: 'REVIEW_REQUIRED' }),
    );
    expect(decision.recommendation).toBe('INSUFFICIENT_DATA');
    expect(decision.nextAction).toBe('REVIEW_OPPORTUNITY');
    expect(decision.automationLevel).toBe('HUMAN_REQUIRED');
  });
});

function item(
  recommendation: PlanDecisionItem['decision']['recommendation'],
  automation: PlanDecisionItem['decision']['automationLevel'],
): PlanDecisionItem {
  return {
    opportunityId: recommendation,
    platformId: 'p',
    platformName: 'P',
    placementType: 'BUSINESS_PROFILE',
    placementMethod: 'API',
    score: 80,
    overallScore: null,
    donorQuality: null,
    riskLevel: 'LOW',
    providerAvailable: true,
    decision: {
      recommendation,
      recommendationReason: 'r',
      nextAction: 'REVIEW_OPPORTUNITY',
      automationLevel: automation,
      riskExplanation: null,
      suggestedPlacementApproach: null,
      rejectionReason:
        recommendation === 'NOT_RECOMMENDED' ? { kind: 'LOW_SCORE', text: 'low' } : null,
    },
    anchorRecommendation: null,
  };
}

describe('buildPlanSummary', () => {
  it('counts buckets and computes the weighted automation percentage', () => {
    const summary = buildPlanSummary([
      item('RECOMMENDED', 'AUTOMATIC'),
      item('RECOMMENDED', 'AI_ASSISTED'),
      item('REVIEW_REQUIRED', 'HUMAN_REQUIRED'),
      item('NOT_RECOMMENDED', 'HUMAN_REQUIRED'),
      item('INSUFFICIENT_DATA', 'HUMAN_REQUIRED'),
    ]);
    expect(summary.total).toBe(5);
    expect(summary.recommended).toBe(2);
    expect(summary.reviewRequired).toBe(1);
    expect(summary.notRecommended).toBe(1);
    expect(summary.insufficientData).toBe(1);
    // (1 + 0.5) / 5 = 30%
    expect(summary.automationPercent).toBe(30);
    expect(summary.byRejectionReason).toEqual(['LOW_SCORE']);
  });

  it('returns zero automation for an empty plan', () => {
    const summary = buildPlanSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.automationPercent).toBe(0);
  });
});

describe('pickRecommendedToStart', () => {
  it('returns the strongest RECOMMENDED items sorted by overall score', () => {
    const items = [
      {
        ...item('RECOMMENDED', 'AUTOMATIC'),
        opportunityId: 'a',
        platformName: 'A',
        overallScore: 70,
      },
      {
        ...item('RECOMMENDED', 'AUTOMATIC'),
        opportunityId: 'b',
        platformName: 'B',
        overallScore: 90,
      },
      {
        ...item('RECOMMENDED', 'AUTOMATIC'),
        opportunityId: 'c',
        platformName: 'C',
        overallScore: 80,
      },
      {
        ...item('RECOMMENDED', 'AUTOMATIC'),
        opportunityId: 'd',
        platformName: 'D',
        overallScore: 95,
      },
      item('REVIEW_REQUIRED', 'HUMAN_REQUIRED'),
    ] as PlanDecisionItem[];
    const start = pickRecommendedToStart(items, 3);
    expect(start.map((item) => item.opportunityId)).toEqual(['d', 'b', 'c']);
  });

  it('returns an empty list when nothing is recommended', () => {
    expect(pickRecommendedToStart([item('NOT_RECOMMENDED', 'HUMAN_REQUIRED')])).toEqual([]);
  });
});
