import type { PlacementStatus } from './enums/placement-status.js';
import type { PlacementType } from './enums/placement-type.js';
import type { PlacementMethod } from './enums/placement-method.js';
import type { ProviderType } from './enums/provider-type.js';
import type { ProviderCapability } from './enums/provider-capability.js';
import type { VerificationStatus } from './enums/verification-status.js';
import type { EvidenceType } from './enums/evidence-type.js';
import type { CampaignStatus } from './enums/campaign-status.js';
import type { AIAnalysisType, AIAnalysisValidationStatus } from './enums/ai-analysis.js';
import type {
  PlacementRecommendation,
  RecommendedAction,
  AutomationLevel,
  RejectionReasonKind,
} from './enums/placement-recommendation.js';

export type {
  PlacementStatus,
  PlacementType,
  PlacementMethod,
  ProviderType,
  ProviderCapability,
  VerificationStatus,
  EvidenceType,
  CampaignStatus,
  AIAnalysisType,
  AIAnalysisValidationStatus,
  PlacementRecommendation,
  RecommendedAction,
  AutomationLevel,
  RejectionReasonKind,
};

export { PLACEMENT_STATUSES } from './enums/placement-status.js';
export { PLACEMENT_TYPES } from './enums/placement-type.js';
export { PLACEMENT_METHODS } from './enums/placement-method.js';
export { PROVIDER_TYPES } from './enums/provider-type.js';
export { PROVIDER_CAPABILITIES } from './enums/provider-capability.js';
export { VERIFICATION_STATUSES } from './enums/verification-status.js';
export { EVIDENCE_TYPES } from './enums/evidence-type.js';
export { CAMPAIGN_STATUSES } from './enums/campaign-status.js';
export { AI_ANALYSIS_TYPES, AI_ANALYSIS_VALIDATION_STATUSES } from './enums/ai-analysis.js';
export {
  PLACEMENT_RECOMMENDATIONS,
  RECOMMENDED_ACTIONS,
  AUTOMATION_LEVELS,
  REJECTION_REASONS,
} from './enums/placement-recommendation.js';

export {
  DomainError,
  ValidationError,
  InvalidPlacementTransitionError,
  UnsupportedCapabilityError,
} from './errors.js';

export type { Company } from './entities/company.js';
export type { Campaign } from './entities/campaign.js';
export type { PlacementCategory } from './entities/placement-category.js';
export type { Platform } from './entities/platform.js';
export type { PlacementProvider } from './entities/placement-provider.js';
export type { PlacementOpportunity } from './entities/placement-opportunity.js';
export type { Placement } from './entities/placement.js';
export type { Verification } from './entities/verification.js';
export type { Evidence } from './entities/evidence.js';
export type { AIAnalysis } from './entities/ai-analysis.js';
export type { AuditLogEntry } from './entities/audit-log.js';

export {
  PLACEMENT_TRANSITIONS,
  canTransitionPlacement,
  assertTransitionPlacement,
} from './state-machine/placement-state-machine.js';

export { supportsCapability, requireCapability } from './capabilities.js';
export type { CapabilitySet } from './capabilities.js';

export {
  EXECUTION_REQUIRED_CAPABILITIES,
  providerSupportsAll,
  selectBestProvider,
  derivePlacementMethod,
  deriveProviderAlignment,
} from './alignment.js';
export type { ProviderAlignment } from './alignment.js';

export {
  DEFAULT_PLACEMENT_TYPE_BY_CATEGORY,
  DEFAULT_PLACEMENT_TYPE,
  placementTypeForCategory,
} from './placement-strategy.js';
export type { PlacementStrategy, PlacementStrategyItem } from './placement-strategy.js';

export {
  SCORE_DIMENSIONS,
  SCORE_DIMENSION_WEIGHTS,
  MIN_SCORE,
  MAX_SCORE,
  isScoreInRange,
  validateScore,
  validateScoreBreakdown,
  calculateScoreBreakdown,
} from './scoring.js';
export type { ScoreDimension, ScoreBreakdown, ScoreInputs } from './scoring.js';

export { validateCompany } from './validation/company.js';
export type { CompanyDraft } from './validation/company.js';

export { validateCampaign } from './validation/campaign.js';
export type { CampaignDraft } from './validation/campaign.js';

export { validateOpportunity } from './validation/opportunity.js';
export type { OpportunityDraft } from './validation/opportunity.js';
export {
  validatePlacement,
  validateManualPlacementRequest,
  validateManualPlacementCompletion,
} from './validation/placement.js';

export type {
  PlacementDraft,
  ManualPlacementRequestDraft,
  ManualPlacementCompletionDraft,
} from './validation/placement.js';

export { validateVerification } from './validation/verification.js';
export type { VerificationDraft } from './validation/verification.js';

export { validateEvidence } from './validation/evidence.js';
export type { EvidenceDraft } from './validation/evidence.js';

export {
  PLACEMENT_TYPE_WORKFLOWS,
  WORKFLOW_STAGE_KINDS,
  workflowForType,
  workflowCurrentStageKind,
  OUTREACH_METHOD_PLACEMENT_TYPES,
  isOutreachPlacementType,
} from './workflow.js';
export type { PlacementTypeWorkflow, WorkflowStage, WorkflowStageKind } from './workflow.js';

export {
  METRIC_STATUSES,
  isKnownDatum,
  unknownDatum,
  syntheticDatum,
  DONOR_QUALITY_LEVELS,
  DONOR_QUALITY_DIMENSION_WEIGHTS,
  DONOR_QUALITY_DIMENSIONS,
  emptyDonorQualityProfile,
  calculateDonorQuality,
  levelFor,
  validateDonorQualityProfile,
} from './donor-quality.js';
export type {
  MetricStatus,
  MetricDatum,
  IndexingStatus,
  BacklinkProfile,
  DonorQualityProfile,
  DonorQualityLevel,
} from './donor-quality.js';

export { PAGE_TYPES, emptyPageAnalysis } from './page-analysis.js';
export type { PageType, OutboundLinkSignals, PageAnalysis } from './page-analysis.js';

export { ANCHOR_TYPES, recommendAnchorType, anchorTypeLabel } from './anchors.js';
export type { AnchorType, AnchorRecommendation, AnchorRecommendationInput } from './anchors.js';

export type { LinkInsertDraft } from './link-insert.js';

export {
  RISK_LEVELS,
  RISK_SIGNAL_KINDS,
  RISK_SIGNAL_LABELS,
  assessDonorRisk,
  riskToScore,
} from './donor-risk.js';
export type { RiskLevel, RiskSignalKind, RiskSignal, DonorRiskAssessment } from './donor-risk.js';

export {
  SCORE_V2_WEIGHTS,
  isScoreV2ComponentInRange,
  calculateScoreV2,
  scoreV2From,
} from './score-v2.js';
export type { ScoreV2Components, ScoreV2Input } from './score-v2.js';

export {
  OUTREACH_STATUSES,
  OUTREACH_TRANSITIONS,
  canTransitionOutreach,
  assertTransitionOutreach,
  initialOutreachDraft,
} from './outreach.js';
export type { OutreachStatus, OutreachMessage, OutreachDraft } from './outreach.js';

export { NEGOTIATION_INTENTS, emptyNegotiationSession } from './negotiation.js';
export type {
  NegotiationIntent,
  PriceRange,
  NegotiationAnalysis,
  NegotiationReply,
  NegotiationSession,
} from './negotiation.js';

export { HUMAN_ACTION_KINDS, deriveHumanActions } from './hitl.js';
export type { HumanActionKind, HumanActionItem, HumanActionContext } from './hitl.js';

export {
  PLAN_MIN_SCORE_RECOMMENDED,
  PLAN_MIN_SCORE_REVIEW_REQUIRED,
  reconcilePlanDecision,
  buildPlanSummary,
  pickRecommendedToStart,
} from './placement-plan.js';
export type {
  PlanDecisionSignals,
  PlanDecisionAiSuggestion,
  RejectionReason,
  PlanDecision,
  AnchorPlanRecommendation,
  PlanDecisionItem,
  PlanSummary,
  PlacementPlan,
} from './placement-plan.js';

export { derivePlacementMethodForType } from './alignment.js';
