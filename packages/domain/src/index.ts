import type { PlacementStatus } from './enums/placement-status.js';
import type { PlacementType } from './enums/placement-type.js';
import type { PlacementMethod } from './enums/placement-method.js';
import type { ProviderType } from './enums/provider-type.js';
import type { ProviderCapability } from './enums/provider-capability.js';
import type { VerificationStatus } from './enums/verification-status.js';
import type { EvidenceType } from './enums/evidence-type.js';
import type { CampaignStatus } from './enums/campaign-status.js';
import type { AIAnalysisType, AIAnalysisValidationStatus } from './enums/ai-analysis.js';

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
};

export { PLACEMENT_STATUSES } from './enums/placement-status.js';
export { PLACEMENT_TYPES } from './enums/placement-type.js';
export { PLACEMENT_METHODS } from './enums/placement-method.js';
export { PROVIDER_TYPES } from './enums/provider-type.js';
export { PROVIDER_CAPABILITIES } from './enums/provider-capability.js';
export { VERIFICATION_STATUSES } from './enums/verification-status.js';
export { EVIDENCE_TYPES } from './enums/evidence-type.js';
export { CAMPAIGN_STATUSES } from './enums/campaign-status.js';
export {
  AI_ANALYSIS_TYPES,
  AI_ANALYSIS_VALIDATION_STATUSES,
} from './enums/ai-analysis.js';

export {
  DomainError,
  ValidationError,
  InvalidPlacementTransitionError,
  UnsupportedCapabilityError,
} from './errors.js';

export type {
  Company,
} from './entities/company.js';
export type {
  Campaign,
} from './entities/campaign.js';
export type {
  PlacementCategory,
} from './entities/placement-category.js';
export type {
  Platform,
} from './entities/platform.js';
export type {
  PlacementProvider,
} from './entities/placement-provider.js';
export type {
  PlacementOpportunity,
} from './entities/placement-opportunity.js';
export type {
  Placement,
} from './entities/placement.js';
export type {
  Verification,
} from './entities/verification.js';
export type {
  Evidence,
} from './entities/evidence.js';
export type {
  AIAnalysis,
} from './entities/ai-analysis.js';
export type {
  AuditLogEntry,
} from './entities/audit-log.js';

export {
  PLACEMENT_TRANSITIONS,
  canTransitionPlacement,
  assertTransitionPlacement,
} from './state-machine/placement-state-machine.js';

export {
  supportsCapability,
  requireCapability,
} from './capabilities.js';
export type { CapabilitySet } from './capabilities.js';

export {
  SCORE_DIMENSIONS,
  SCORE_DIMENSION_WEIGHTS,
  MIN_SCORE,
  MAX_SCORE,
  isScoreInRange,
  validateScore,
  validateScoreBreakdown,
} from './scoring.js';
export type { ScoreDimension, ScoreBreakdown } from './scoring.js';

export { validateCompany } from './validation/company.js';
export type { CompanyDraft } from './validation/company.js';