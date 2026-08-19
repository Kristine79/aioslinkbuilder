/**
 * Placement Plan decision vocabulary.
 *
 * Every discovered opportunity ends up in exactly one recommendation bucket;
 * the plan's decision engine assigns a concrete next action and an automation
 * level to each item. The buckets/actions/levels are shared vocabulary between
 * the deterministic planner, the AI provider output schema and the UI.
 */

/** Decision bucket assigned to an opportunity by the placement plan. */
export const PLACEMENT_RECOMMENDATIONS = [
  'RECOMMENDED',
  'REVIEW_REQUIRED',
  'NOT_RECOMMENDED',
  'INSUFFICIENT_DATA',
] as const;

export type PlacementRecommendation = (typeof PLACEMENT_RECOMMENDATIONS)[number];

/** Concrete next step the plan proposes for an opportunity. */
export const RECOMMENDED_ACTIONS = [
  'PREPARE_OUTREACH',
  'REQUEST_MANUAL_PLACEMENT',
  'EXECUTE_AUTOMATICALLY',
  'REVIEW_PROVIDER',
  'REVIEW_OPPORTUNITY',
  'REJECT',
] as const;

export type RecommendedAction = (typeof RECOMMENDED_ACTIONS)[number];

/** How much human involvement the recommended action requires. */
export const AUTOMATION_LEVELS = ['AUTOMATIC', 'AI_ASSISTED', 'HUMAN_REQUIRED'] as const;

export type AutomationLevel = (typeof AUTOMATION_LEVELS)[number];

/**
 * Why an opportunity was not recommended. The kind is derived from actual
 * opportunity data (score, risk, provider, strategy) — never fabricated.
 */
export const REJECTION_REASONS = [
  'LOW_SCORE',
  'LOW_RELEVANCE',
  'UNSUITABLE_PLACEMENT_TYPE',
  'NO_PROVIDER',
  'HIGH_RISK',
  'MANUAL_NEGOTIATION_REQUIRED',
  'REJECTED_BY_AI',
] as const;

export type RejectionReasonKind = (typeof REJECTION_REASONS)[number];
