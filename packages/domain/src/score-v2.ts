import type { DonorQualityProfile } from './donor-quality.js';
import type { DonorRiskAssessment } from './donor-risk.js';
import { riskToScore } from './donor-risk.js';
import type { PlacementMethod } from './enums/placement-method.js';
import { ValidationError } from './errors.js';
import type { ScoreBreakdown } from './scoring.js';

/**
 * Opportunity Score 2.0.
 *
 * The deterministic Score 1.0 (`calculateScoreBreakdown`, the single source
 * of truth) is extended, not replaced: the v2 view separates five dimensions
 * and combines them into one overall number.
 *
 * - RELEVANCE SCORE        — topical/audience/geography fit (AI supplies the
 *                            semantic inputs, domain computes the number);
 * - DONOR QUALITY SCORE    — deterministic donor quality score;
 * - PLACEMENT QUALITY SCORE— quality of the specific placement (page fit,
 *                            placement method);
 * - EXECUTION SCORE        — automation potential adjusted by execution method;
 * - RISK SCORE             — inverse of the deterministic risk level.
 *
 * Overall weights are documented in SCORING.md and are deterministic. AI
 * never writes a final numeric score — it only supplies dimensions that the
 * domain then weights.
 */

export interface ScoreV2Components {
  relevanceScore: number;
  donorQualityScore: number;
  placementQualityScore: number;
  executionScore: number;
  riskScore: number;
  overall: number;
}

export const SCORE_V2_WEIGHTS = {
  relevance: 30,
  donorQuality: 25,
  placementQuality: 20,
  execution: 15,
  risk: 10,
} as const;

const WEIGHT_TOTAL = 100;

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function isScoreV2ComponentInRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

export function calculateScoreV2(
  components: Omit<ScoreV2Components, 'overall'>,
): ScoreV2Components {
  for (const key of [
    'relevanceScore',
    'donorQualityScore',
    'placementQualityScore',
    'executionScore',
    'riskScore',
  ] as const) {
    if (!isScoreV2ComponentInRange(components[key])) {
      throw new ValidationError(`Score V2 component ${key} must be between 0 and 100`);
    }
  }
  const overall = clamp(
    (components.relevanceScore * SCORE_V2_WEIGHTS.relevance +
      components.donorQualityScore * SCORE_V2_WEIGHTS.donorQuality +
      components.placementQualityScore * SCORE_V2_WEIGHTS.placementQuality +
      components.executionScore * SCORE_V2_WEIGHTS.execution +
      components.riskScore * SCORE_V2_WEIGHTS.risk) /
      WEIGHT_TOTAL,
  );
  return { ...components, overall };
}

export interface ScoreV2Input {
  breakdown: ScoreBreakdown | null;
  donorQuality: DonorQualityProfile | null;
  risk: DonorRiskAssessment | null;
  placementMethod: PlacementMethod;
  /** Page-level link-insert suitability, when available. */
  pageLinkInsertSuitability: number | null;
}

const RELEVANCE_WEIGHTS = { topical: 30, audience: 20, geographic: 15 } as const;

function relevanceFromBreakdown(breakdown: ScoreBreakdown | null): number | null {
  if (breakdown === null) return null;
  const total =
    RELEVANCE_WEIGHTS.topical + RELEVANCE_WEIGHTS.audience + RELEVANCE_WEIGHTS.geographic;
  return clamp(
    (breakdown.topicalRelevance * RELEVANCE_WEIGHTS.topical +
      breakdown.audienceMatch * RELEVANCE_WEIGHTS.audience +
      breakdown.geographicRelevance * RELEVANCE_WEIGHTS.geographic) /
      total,
  );
}

function executionFrom(breakdown: ScoreBreakdown | null, method: PlacementMethod): number {
  const base = breakdown?.automationPotential ?? 50;
  const adjustment: Readonly<Record<PlacementMethod, number>> = {
    API: 0,
    SEMI_AUTOMATED: 0,
    BROWSER: -5,
    MANUAL: -15,
    OUTREACH: -10,
    UNKNOWN: -20,
  };
  return clamp(base + adjustment[method]);
}

/**
 * Derives the Score 2.0 components from the existing deterministic Score 1.0
 * breakdown plus the donor quality / risk assessments. Returns null when the
 * opportunity has not been scored yet (no breakdown).
 */
export function scoreV2From(input: ScoreV2Input): ScoreV2Components | null {
  if (input.breakdown === null) return null;

  const relevance = relevanceFromBreakdown(input.breakdown);
  const donorQuality = input.donorQuality?.overallDonorQuality ?? 50;
  const pageSuitability = input.pageLinkInsertSuitability;
  const placementQuality =
    pageSuitability !== null
      ? clamp((input.breakdown.placementQuality + pageSuitability) / 2)
      : input.breakdown.placementQuality;
  const execution = executionFrom(input.breakdown, input.placementMethod);
  const risk = input.risk === null ? 50 : riskToScore(input.risk.level);

  return calculateScoreV2({
    relevanceScore: relevance ?? 50,
    donorQualityScore: donorQuality,
    placementQualityScore: placementQuality,
    executionScore: execution,
    riskScore: risk,
  });
}
