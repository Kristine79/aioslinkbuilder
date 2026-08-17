import { ValidationError } from './errors.js';

export const SCORE_DIMENSIONS = [
  'topicalRelevance',
  'audienceMatch',
  'geographicRelevance',
  'authority',
  'placementQuality',
  'automationPotential',
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

/** Weights from SCORING.md. The deterministic scoring calculation is implemented in a later phase. */
export const SCORE_DIMENSION_WEIGHTS: Readonly<Record<ScoreDimension, number>> = {
  topicalRelevance: 30,
  audienceMatch: 20,
  geographicRelevance: 15,
  authority: 15,
  placementQuality: 10,
  automationPotential: 10,
};

export const MIN_SCORE = 0;
export const MAX_SCORE = 100;

export interface ScoreBreakdown {
  topicalRelevance: number;
  audienceMatch: number;
  geographicRelevance: number;
  authority: number;
  placementQuality: number;
  automationPotential: number;
  total: number;
}

export function isScoreInRange(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_SCORE && value <= MAX_SCORE;
}

export function validateScoreBreakdown(breakdown: ScoreBreakdown): void {
  for (const dimension of SCORE_DIMENSIONS) {
    if (!isScoreInRange(breakdown[dimension])) {
      throw new ValidationError(
        `Score component ${dimension} must be between ${MIN_SCORE} and ${MAX_SCORE}`,
      );
    }
  }
  if (!isScoreInRange(breakdown.total)) {
    throw new ValidationError(`Total score must be between ${MIN_SCORE} and ${MAX_SCORE}`);
  }
}

export function validateScore(score: number): void {
  if (!isScoreInRange(score)) {
    throw new ValidationError(`Score must be between ${MIN_SCORE} and ${MAX_SCORE}`);
  }
}
