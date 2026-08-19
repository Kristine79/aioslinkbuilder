import type { AnchorType } from './anchors.js';
import type { PlacementMethod } from './enums/placement-method.js';
import type { PlacementType } from './enums/placement-type.js';
import type { RiskLevel } from './donor-risk.js';
import type {
  AutomationLevel,
  PlacementRecommendation,
  RecommendedAction,
  RejectionReasonKind,
} from './enums/placement-recommendation.js';

/**
 * AI Placement Decision Engine — deterministic reconciliation layer.
 *
 * The placement plan is the operational decision layer above discovery,
 * classification and scoring. AI interprets the existing signals (score,
 * risk, provider, strategy) and suggests a decision; this module reconciles
 * every suggestion with the deterministic ground truth before it can reach
 * the UI. The AI never decides critical placement state on its own.
 *
 * Responsibilities:
 * - every opportunity ends up in exactly one recommendation bucket;
 * - the deterministic score/risk/provider state cannot be contradicted
 *   (e.g. an API-only action is impossible without a provider);
 * - rejected items carry a reason derived from actual opportunity data;
 * - the summary and automation percentage are pure functions of the items.
 */

export const PLAN_MIN_SCORE_RECOMMENDED = 75;
export const PLAN_MIN_SCORE_REVIEW_REQUIRED = 55;

/** Deterministic signals the planner uses to reconcile an AI suggestion. */
export interface PlanDecisionSignals {
  score: number | null;
  overallScore: number | null;
  riskLevel: RiskLevel | null;
  placementMethod: PlacementMethod;
  placementType: PlacementType;
  /** Whether the alignment found a usable provider for the execution path. */
  providerAvailable: boolean;
  /** Whether the aligned provider has verified capabilities. */
  providerCapabilitiesVerified: boolean;
  /** Whether donor/page intelligence (intel) was already assessed. */
  hasIntel: boolean;
  /** Whether the strategy for the opportunity category supports placementType. */
  strategySupportsType: boolean;
}

/** AI-suggested decision for a single opportunity (schema validated). */
export interface PlanDecisionAiSuggestion {
  recommendation: PlacementRecommendation;
  recommendationReason: string;
  nextAction: RecommendedAction;
  automationLevel: AutomationLevel;
  riskExplanation: string | null;
  suggestedPlacementApproach: string | null;
}

export interface RejectionReason {
  kind: RejectionReasonKind;
  text: string;
}

/** Final, reconciled decision for one opportunity. */
export interface PlanDecision {
  recommendation: PlacementRecommendation;
  recommendationReason: string;
  nextAction: RecommendedAction;
  automationLevel: AutomationLevel;
  riskExplanation: string | null;
  suggestedPlacementApproach: string | null;
  rejectionReason: RejectionReason | null;
}

export interface AnchorPlanRecommendation {
  anchorType: AnchorType;
  anchor: string;
  explanation: string;
}

/** A plan item: the reconciled decision for one discovered opportunity. */
export interface PlanDecisionItem {
  opportunityId: string;
  platformId: string;
  platformName: string;
  placementType: PlacementType;
  placementMethod: PlacementMethod;
  /** Deterministic score (1.0) — unchanged by the plan. */
  score: number | null;
  /** Deterministic Score 2.0 overall — unchanged by the plan. */
  overallScore: number | null;
  donorQuality: number | null;
  riskLevel: RiskLevel | null;
  providerAvailable: boolean;
  decision: PlanDecision;
  anchorRecommendation: AnchorPlanRecommendation | null;
}

export interface PlanSummary {
  total: number;
  recommended: number;
  reviewRequired: number;
  notRecommended: number;
  insufficientData: number;
  automationPercent: number;
  byRejectionReason: RejectionReasonKind[];
}

/** The campaign-level placement plan returned to the UI. */
export interface PlacementPlan {
  campaignId: string;
  generatedAt: Date;
  provider: string;
  model: string | null;
  schemaVersion: string;
  summary: PlanSummary;
  /** Up to 3 strongest RECOMMENDED items to start with. */
  recommendedToStart: Array<{
    opportunityId: string;
    platformName: string;
    placementType: PlacementType;
  }>;
  items: PlanDecisionItem[];
}

/**
 * Reconciles the AI suggestion with deterministic ground truth.
 *
 * The deterministic rules are authoritative:
 * - no score and no intel -> INSUFFICIENT_DATA (a decision cannot be made);
 * - score below the review threshold cannot be RECOMMENDED;
 * - high donor risk forces REVIEW_REQUIRED (never silent automation);
 * - RECOMMENDED without a usable provider for an execution-based method is
 *   NOT_RECOMMENDED (NO_PROVIDER);
 * - outreach/manual methods always require human involvement;
 * - the next action follows the placement method of the opportunity.
 */
export function reconcilePlanDecision(
  signals: PlanDecisionSignals,
  ai: PlanDecisionAiSuggestion,
): PlanDecision {
  const base: PlanDecision = {
    recommendation: ai.recommendation,
    recommendationReason: ai.recommendationReason,
    nextAction: ai.nextAction,
    automationLevel: ai.automationLevel,
    riskExplanation: ai.riskExplanation,
    suggestedPlacementApproach: ai.suggestedPlacementApproach,
    rejectionReason: null,
  };

  const bestScore = effectiveScore(signals.score, signals.overallScore);

  // 1. Not enough information for a reliable decision.
  if (bestScore === null && !signals.hasIntel && signals.riskLevel === null) {
    return {
      ...base,
      recommendation: 'INSUFFICIENT_DATA',
      recommendationReason:
        signals.placementMethod === 'UNKNOWN' || !signals.providerAvailable
          ? 'По возможности недостаточно данных: площадка не оценена и подходящий провайдер не найден.'
          : 'По возможности недостаточно данных: площадка ещё не оценена (нет балла и анализа донора).',
      nextAction: 'REVIEW_OPPORTUNITY',
      automationLevel: 'HUMAN_REQUIRED',
      rejectionReason: null,
    };
  }

  // 2. Deterministic score floor: a weak score cannot be recommended.
  if (bestScore !== null && bestScore < PLAN_MIN_SCORE_REVIEW_REQUIRED) {
    return {
      ...base,
      recommendation: 'NOT_RECOMMENDED',
      recommendationReason: ai.recommendationReason,
      nextAction: 'REJECT',
      automationLevel: 'HUMAN_REQUIRED',
      rejectionReason: {
        kind: 'LOW_SCORE',
        text: `Итоговая оценка ${bestScore} ниже порога рассмотрения (${PLAN_MIN_SCORE_REVIEW_REQUIRED}).`,
      },
    };
  }

  // 3. High donor risk: the human must review before anything happens.
  const highRisk = signals.riskLevel === 'HIGH';
  if (
    highRisk &&
    (ai.recommendation === 'RECOMMENDED' || ai.recommendation === 'REVIEW_REQUIRED')
  ) {
    return {
      ...base,
      recommendation: 'REVIEW_REQUIRED',
      recommendationReason: ai.recommendationReason,
      nextAction: ai.nextAction === 'PREPARE_OUTREACH' ? ai.nextAction : 'REVIEW_OPPORTUNITY',
      automationLevel: 'HUMAN_REQUIRED',
      rejectionReason: null,
    };
  }

  // 4. Mid-range score: the AI may recommend, but a human should confirm.
  if (
    bestScore !== null &&
    bestScore < PLAN_MIN_SCORE_RECOMMENDED &&
    ai.recommendation === 'RECOMMENDED'
  ) {
    return {
      ...base,
      recommendation: 'REVIEW_REQUIRED',
      recommendationReason: ai.recommendationReason,
      nextAction: ai.nextAction === 'PREPARE_OUTREACH' ? ai.nextAction : 'REVIEW_OPPORTUNITY',
      automationLevel: 'HUMAN_REQUIRED',
      rejectionReason: null,
    };
  }

  // 5. No usable provider and the method requires one.
  const executionBased = signals.placementMethod !== 'OUTREACH';
  if (!signals.providerAvailable && executionBased && ai.recommendation !== 'NOT_RECOMMENDED') {
    return {
      ...base,
      recommendation: 'NOT_RECOMMENDED',
      recommendationReason: ai.recommendationReason,
      nextAction: 'REVIEW_PROVIDER',
      automationLevel: 'HUMAN_REQUIRED',
      rejectionReason: {
        kind: 'NO_PROVIDER',
        text: 'Для этого метода размещения не найден провайдер с нужными возможностями.',
      },
    };
  }

  // 6. Strategy mismatch: the placement type is not part of the campaign strategy.
  if (
    ai.recommendation === 'RECOMMENDED' &&
    !signals.strategySupportsType &&
    bestScore !== null &&
    bestScore < PLAN_MIN_SCORE_RECOMMENDED
  ) {
    return {
      ...base,
      recommendation: 'REVIEW_REQUIRED',
      recommendationReason: ai.recommendationReason,
      nextAction: 'REVIEW_OPPORTUNITY',
      automationLevel: 'HUMAN_REQUIRED',
      rejectionReason: null,
    };
  }

  // 7. NOT_RECOMMENDED: derive the rejection reason from the actual data.
  if (base.recommendation === 'NOT_RECOMMENDED') {
    return { ...base, nextAction: 'REJECT', rejectionReason: deriveRejectionReason(signals) };
  }

  // 8. RECOMMENDED / INSUFFICIENT_DATA: bind the action and automation to the
  //    deterministic execution model.
  const { nextAction, automationLevel } = bindExecution(signals, base);
  return { ...base, nextAction, automationLevel };
}

/** Which strong signal explains the rejection (in priority order). */
function deriveRejectionReason(signals: PlanDecisionSignals): RejectionReason {
  const bestScore = effectiveScore(signals.score, signals.overallScore);
  if (bestScore !== null && bestScore < PLAN_MIN_SCORE_REVIEW_REQUIRED) {
    return {
      kind: 'LOW_SCORE',
      text: `Итоговая оценка ${bestScore} ниже порога рассмотрения (${PLAN_MIN_SCORE_REVIEW_REQUIRED}).`,
    };
  }
  if (signals.riskLevel === 'HIGH') {
    return {
      kind: 'HIGH_RISK',
      text: 'Профиль донора несёт высокий риск (спам, индексация, качество).',
    };
  }
  if (!signals.providerAvailable) {
    return {
      kind: 'NO_PROVIDER',
      text: 'Для этого метода размещения не найден провайдер с нужными возможностями.',
    };
  }
  if (!signals.strategySupportsType) {
    return {
      kind: 'UNSUITABLE_PLACEMENT_TYPE',
      text: 'Выбранный тип размещения не входит в стратегию кампании для этой категории.',
    };
  }
  if (signals.placementMethod === 'OUTREACH' || signals.placementMethod === 'MANUAL') {
    return {
      kind: 'MANUAL_NEGOTIATION_REQUIRED',
      text: 'Размещение требует переговоров и ручной работы, автоматическое исполнение невозможно.',
    };
  }
  if (bestScore !== null && bestScore < PLAN_MIN_SCORE_RECOMMENDED) {
    return {
      kind: 'LOW_SCORE',
      text: `Итоговая оценка ${bestScore} ниже порога уверенности (${PLAN_MIN_SCORE_RECOMMENDED}).`,
    };
  }
  return {
    kind: 'LOW_RELEVANCE',
    text: 'Оценка AI указывает на низкую тематическую релевантность для этой кампании.',
  };
}

/** Binds the next action and automation level to the execution model. */
function bindExecution(
  signals: PlanDecisionSignals,
  decision: PlanDecision,
): { nextAction: RecommendedAction; automationLevel: AutomationLevel } {
  if (decision.recommendation === 'INSUFFICIENT_DATA') {
    return { nextAction: 'REVIEW_OPPORTUNITY', automationLevel: 'HUMAN_REQUIRED' };
  }
  if (decision.recommendation !== 'RECOMMENDED') {
    return {
      nextAction: decision.nextAction === 'REJECT' ? 'REJECT' : 'REVIEW_OPPORTUNITY',
      automationLevel: 'HUMAN_REQUIRED',
    };
  }

  let nextAction: RecommendedAction = decision.nextAction;
  switch (signals.placementMethod) {
    case 'API':
      nextAction = 'EXECUTE_AUTOMATICALLY';
      break;
    case 'BROWSER':
      nextAction = signals.providerCapabilitiesVerified
        ? 'EXECUTE_AUTOMATICALLY'
        : 'REVIEW_PROVIDER';
      break;
    case 'OUTREACH':
      nextAction = 'PREPARE_OUTREACH';
      break;
    case 'MANUAL':
      nextAction = 'REQUEST_MANUAL_PLACEMENT';
      break;
    default:
      nextAction = 'REVIEW_OPPORTUNITY';
      break;
  }

  let automationLevel: AutomationLevel = decision.automationLevel;
  if (signals.placementMethod === 'OUTREACH' || signals.placementMethod === 'MANUAL') {
    automationLevel = 'HUMAN_REQUIRED';
  } else if (signals.placementMethod === 'BROWSER' || !signals.providerCapabilitiesVerified) {
    automationLevel = automationLevel === 'HUMAN_REQUIRED' ? 'HUMAN_REQUIRED' : 'AI_ASSISTED';
  } else {
    automationLevel = automationLevel === 'HUMAN_REQUIRED' ? 'HUMAN_REQUIRED' : 'AUTOMATIC';
  }

  return { nextAction, automationLevel };
}

function effectiveScore(score: number | null, overallScore: number | null): number | null {
  if (score !== null && overallScore !== null) {
    return Math.round((score + overallScore) / 2);
  }
  return score ?? overallScore;
}

/**
 * Deterministic summary of the plan items. The automation percentage is a
 * weighted share: AUTOMATIC = 1, AI_ASSISTED = 0.5, HUMAN_REQUIRED = 0.
 */
export function buildPlanSummary(items: readonly PlanDecisionItem[]): PlanSummary {
  let recommended = 0;
  let reviewRequired = 0;
  let notRecommended = 0;
  let insufficientData = 0;
  let automationWeight = 0;
  const rejectionReasons: RejectionReasonKind[] = [];
  for (const item of items) {
    switch (item.decision.recommendation) {
      case 'RECOMMENDED':
        recommended += 1;
        break;
      case 'REVIEW_REQUIRED':
        reviewRequired += 1;
        break;
      case 'NOT_RECOMMENDED':
        notRecommended += 1;
        break;
      case 'INSUFFICIENT_DATA':
        insufficientData += 1;
        break;
    }
    switch (item.decision.automationLevel) {
      case 'AUTOMATIC':
        automationWeight += 1;
        break;
      case 'AI_ASSISTED':
        automationWeight += 0.5;
        break;
      case 'HUMAN_REQUIRED':
        break;
    }
    const reason = item.decision.rejectionReason;
    if (reason !== null && !rejectionReasons.includes(reason.kind)) {
      rejectionReasons.push(reason.kind);
    }
  }
  const total = items.length;
  const automationPercent = total === 0 ? 0 : Math.round((automationWeight / total) * 100);
  return {
    total,
    recommended,
    reviewRequired,
    notRecommended,
    insufficientData,
    automationPercent,
    byRejectionReason: rejectionReasons,
  };
}

/** The strongest RECOMMENDED items to start with (score 2.0 first, then 1.0). */
export function pickRecommendedToStart(
  items: readonly PlanDecisionItem[],
  limit = 3,
): PlacementPlan['recommendedToStart'] {
  return [...items]
    .filter((item) => item.decision.recommendation === 'RECOMMENDED')
    .sort(
      (a, b) =>
        (b.overallScore ?? b.score ?? -1) - (a.overallScore ?? a.score ?? -1) ||
        (b.score ?? -1) - (a.score ?? -1) ||
        a.platformName.localeCompare(b.platformName),
    )
    .slice(0, limit)
    .map((item) => ({
      opportunityId: item.opportunityId,
      platformName: item.platformName,
      placementType: item.placementType,
    }));
}
