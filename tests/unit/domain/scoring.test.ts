import { describe, expect, it } from 'vitest';

import { SCORE_DIMENSION_WEIGHTS, ValidationError, calculateScoreBreakdown } from '@aios/domain';

describe('calculateScoreBreakdown', () => {
  it('produces the weighted average per SCORING.md weights', () => {
    const breakdown = calculateScoreBreakdown({
      topicalRelevance: 90,
      audienceMatch: 80,
      geographicRelevance: 70,
      authority: 60,
      placementQuality: 50,
      automationPotential: 40,
    });

    const expected =
      (90 * SCORE_DIMENSION_WEIGHTS.topicalRelevance +
        80 * SCORE_DIMENSION_WEIGHTS.audienceMatch +
        70 * SCORE_DIMENSION_WEIGHTS.geographicRelevance +
        60 * SCORE_DIMENSION_WEIGHTS.authority +
        50 * SCORE_DIMENSION_WEIGHTS.placementQuality +
        40 * SCORE_DIMENSION_WEIGHTS.automationPotential) /
      100;

    expect(breakdown.total).toBe(Math.round(expected));
    expect(breakdown).toEqual({
      topicalRelevance: 90,
      audienceMatch: 80,
      geographicRelevance: 70,
      authority: 60,
      placementQuality: 50,
      automationPotential: 40,
      total: Math.round(expected),
    });
  });

  it('returns 100 only when every dimension is 100', () => {
    const breakdown = calculateScoreBreakdown({
      topicalRelevance: 100,
      audienceMatch: 100,
      geographicRelevance: 100,
      authority: 100,
      placementQuality: 100,
      automationPotential: 100,
    });

    expect(breakdown.total).toBe(100);
  });

  it('returns 0 when every dimension is 0', () => {
    const breakdown = calculateScoreBreakdown({
      topicalRelevance: 0,
      audienceMatch: 0,
      geographicRelevance: 0,
      authority: 0,
      placementQuality: 0,
      automationPotential: 0,
    });

    expect(breakdown.total).toBe(0);
  });

  it('rounds the total to the nearest integer', () => {
    const breakdown = calculateScoreBreakdown({
      topicalRelevance: 83,
      audienceMatch: 0,
      geographicRelevance: 0,
      authority: 0,
      placementQuality: 0,
      automationPotential: 0,
    });

    expect(breakdown.total).toBe(25);
  });

  it('rejects dimension values outside 0..100', () => {
    expect(() =>
      calculateScoreBreakdown({
        topicalRelevance: 101,
        audienceMatch: 0,
        geographicRelevance: 0,
        authority: 0,
        placementQuality: 0,
        automationPotential: 0,
      }),
    ).toThrow(ValidationError);

    expect(() =>
      calculateScoreBreakdown({
        topicalRelevance: 0,
        audienceMatch: -1,
        geographicRelevance: 0,
        authority: 0,
        placementQuality: 0,
        automationPotential: 0,
      }),
    ).toThrow(ValidationError);
  });

  it('rejects non-finite dimension values', () => {
    expect(() =>
      calculateScoreBreakdown({
        topicalRelevance: Number.NaN,
        audienceMatch: 0,
        geographicRelevance: 0,
        authority: 0,
        placementQuality: 0,
        automationPotential: 0,
      }),
    ).toThrow(ValidationError);
  });
});
