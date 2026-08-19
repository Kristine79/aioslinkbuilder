/**
 * API DTO types mirroring the delivery layer responses (apps/api/src/dto.ts).
 * The frontend never computes business state: every value comes from the
 * backend, including allowed actions for the current state.
 */

export type PlacementStatus =
  | 'DISCOVERED'
  | 'QUALIFIED'
  | 'SELECTED'
  | 'READY'
  | 'SUBMITTED'
  | 'PENDING_PUBLICATION'
  | 'PUBLISHED'
  | 'VERIFIED'
  | 'FAILED'
  | 'BLOCKED'
  | 'NEEDS_MANUAL'
  | 'VERIFICATION_FAILED'
  | 'REJECTED';

export type OpportunityAction = 'approve' | 'execute' | 'requestManual';
export type PlacementAction = 'monitor' | 'verify' | 'completeManual';
export type VerificationStatus = 'PENDING' | 'PASSED' | 'FAILED';
export type EvidenceType =
  'LIVE_URL' | 'SCREENSHOT' | 'PAGE_CONTENT' | 'COMPANY_MATCH' | 'WEBSITE_MATCH' | 'BACKLINK_MATCH';

export interface CategoryDto {
  id: string;
  code: string;
  name: string;
}

export interface CompanyAnalysisDto {
  provider: string;
  model: string | null;
  createdAt: string;
  businessType: string;
  topics: string[];
  audiences: string[];
  relevantCategories: string[];
  strategicRecommendations: string[];
}

export interface CompanyDto {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  website: string | null;
  geography: string[];
  locations: string[];
  products: string[];
  targetAudience: string[];
  analysis: CompanyAnalysisDto | null;
}

export interface CampaignListItemDto {
  id: string;
  companyId: string;
  name: string;
  goals: string[];
  status: string;
  createdAt: string;
}

export interface CompanyListItemDto {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  description: string | null;
  createdAt: string;
  campaigns: CampaignListItemDto[];
}

export interface StrategyItemDto {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  placementType: string;
  opportunityCount: number;
}

export interface ScoreBreakdownDto {
  topicalRelevance: number;
  audienceMatch: number;
  geographicRelevance: number;
  authority: number;
  placementQuality: number;
  automationPotential: number;
  total: number;
}

export interface ProviderDto {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  capabilitiesVerified: boolean;
}

export interface EvidenceDto {
  id: string;
  type: EvidenceType;
  url: string | null;
  content: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface VerificationDto {
  id: string;
  status: VerificationStatus;
  checkedAt: string | null;
  result: Record<string, unknown> | null;
  failureReason: string | null;
  createdAt: string;
}

export interface PlacementDto {
  id: string;
  opportunityId: string;
  providerId: string | null;
  providerName: string | null;
  providerType: string | null;
  status: PlacementStatus;
  externalId: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  liveUrl: string | null;
  createdAt: string;
  updatedAt: string;
  manual: { reason: string; notes: string | null } | null;
  verification: VerificationDto | null;
  evidence: EvidenceDto[];
  allowedActions: PlacementAction[];
}

export interface OpportunityDto {
  id: string;
  campaignId: string;
  platformId: string;
  platformName: string;
  platformUrl: string | null;
  country: string | null;
  categoryId: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  placementType: string;
  relevance: string | null;
  score: number | null;
  scoreBreakdown: ScoreBreakdownDto | null;
  recommendation: string | null;
  whyRecommended: string | null;
  placementMethod: string;
  providerCapabilities: string[];
  provider: ProviderDto | null;
  discoverySource: string | null;
  status: PlacementStatus;
  createdAt: string;
  updatedAt: string;
  allowedActions: OpportunityAction[];
  placements: PlacementDto[];
  donorQuality: DonorQualityDto | null;
  donorQualityScore: number | null;
  pageAnalysis: PageAnalysisDto | null;
  risk: RiskAssessmentDto | null;
  scoreV2: ScoreV2Dto | null;
  overallScore: number | null;
  linkInsert: LinkInsertDto | null;
  anchorStrategy: AnchorStrategyDto | null;
  outreach: OutreachDto | null;
  negotiation: NegotiationDto | null;
  workflow: WorkflowDto | null;
  humanActions: HumanActionDto[];
  traffic: number | null;
  geography: string[] | null;
  automationAvailable: boolean;
}

export interface MetricDatumDto<T> {
  value: T | null;
  source: string | null;
  status: string;
  confidence: number | null;
  measuredAt: string | null;
}

export interface BacklinkProfileDto {
  referringDomains: number | null;
  totalBacklinks: number | null;
  dofollowRatio: number | null;
}

export interface DonorQualityDto {
  organicTraffic: MetricDatumDto<number>;
  trafficGeography: MetricDatumDto<string[]>;
  keywordProfile: MetricDatumDto<string[]>;
  backlinkProfile: MetricDatumDto<BacklinkProfileDto>;
  authority: MetricDatumDto<number>;
  spamRisk: MetricDatumDto<number>;
  indexingStatus: MetricDatumDto<string>;
  estimatedRealTraffic: MetricDatumDto<number>;
  topicalRelevance: MetricDatumDto<number>;
  audienceMatch: MetricDatumDto<number>;
  geographicRelevance: MetricDatumDto<number>;
  placementQuality: MetricDatumDto<number>;
  automationPotential: MetricDatumDto<number>;
  overallDonorQuality: number | null;
  overallLevel: string;
}

export interface PageAnalysisDto {
  targetDomain: string;
  targetPage: string | null;
  pageTitle: string | null;
  pageType: string;
  topicalRelevance: MetricDatumDto<number>;
  linkInsertSuitability: MetricDatumDto<number>;
  indexation: MetricDatumDto<string>;
  traffic: MetricDatumDto<number>;
  outboundLinkSignals: MetricDatumDto<{
    total: number | null;
    external: number | null;
    dofollow: number | null;
  }>;
  suggestedPlacementLocation: string | null;
  summary: string | null;
  analyzedAt: string;
}

export interface RiskAssessmentDto {
  level: string;
  signals: Array<{ kind: string; severity: number; available: boolean }>;
  reasons: string[];
  aiReasons: string[];
  assessedAt: string;
}

export interface ScoreV2Dto {
  relevanceScore: number;
  donorQualityScore: number;
  placementQualityScore: number;
  executionScore: number;
  riskScore: number;
  overall: number;
}

export interface LinkInsertDto {
  anchor: string;
  anchorAlternatives: string[];
  suggestedInsertionPoint: string;
  text: string;
  explanation: string;
  confidence: number | null;
  placementObjective: string | null;
}

export interface AnchorStrategyDto {
  anchorType: string;
  anchor: string;
  alternatives: string[];
  explanation: string;
  confidence: number;
  profileAvailable: boolean;
}

export interface OutreachMessageDto {
  subject: string;
  message: string;
  shortVersion: string;
  opening: string;
  valueProposition: string;
  placementRequest: string;
  cta: string;
}

export interface OutreachDto {
  status: string;
  message: OutreachMessageDto | null;
  provider: string | null;
  externalId: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NegotiationReplyDto {
  role: 'donor' | 'ai' | 'human';
  text: string;
  at: string;
}

export interface NegotiationDto {
  status: string;
  replies: NegotiationReplyDto[];
  analysis: {
    intent: string;
    suggestedResponse: string;
    strategy: string;
    recommendedPrice: { min: number; max: number; currency: string } | null;
    fallbackOption: string | null;
    risks: string[];
    confidence: number | null;
  } | null;
}

export interface WorkflowStageDto {
  kind: string;
  label: string;
  automated: boolean;
  hitl: boolean;
  required: boolean;
  current: boolean;
}

export interface WorkflowDto {
  placementType: string;
  label: string;
  stages: WorkflowStageDto[];
  currentStageKind: string | null;
}

export interface HumanActionDto {
  id: string;
  kind: string;
  title: string;
  why: string;
  aiPrepared: string;
  humanTask: string;
  actionLabel: string;
  opportunityId: string;
  placementId: string | null;
}

export interface ComparisonRowDto {
  id: string;
  platformName: string;
  platformUrl: string | null;
  categoryName: string | null;
  placementType: string;
  placementMethod: string;
  status: string;
  score: number | null;
  overall: number | null;
  donorQuality: number | null;
  risk: string | null;
  traffic: number | null;
  authority: number | null;
  geographicRelevance: number | null;
  automationAvailable: boolean;
  effort: number;
}

export interface ComparisonResultDto {
  items: ComparisonRowDto[];
  recommendation: { winnerId: string; reason: string } | null;
}

export interface AuditEventDto {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
}

export interface OverviewDto {
  company: { id: string; name: string; industry: string | null; website: string | null };
  campaign: { id: string; name: string; goals: string[]; status: string };
  counts: {
    opportunities: number;
    recommended: number;
    approved: number;
    ready: number;
    executed: number;
    published: number;
    verified: number;
    failed: number;
    manual: number;
  };
  totalPlacements: number;
  funnel: Array<{ stage: string; count: number }>;
  manualActions: Array<{
    placementId: string;
    opportunityId: string;
    platformId: string;
    platformName: string;
    reason: string;
  }>;
  humanActions: HumanActionDto[];
  negotiations: Array<{
    opportunityId: string;
    platformName: string;
    outreachStatus: string | null;
    negotiationIntent: string | null;
  }>;
  recentActivity: AuditEventDto[];
}

export interface VerificationListItemDto {
  id: string;
  placementId: string;
  platformName: string;
  platformUrl: string | null;
  placementStatus: PlacementStatus;
  verificationStatus: VerificationStatus;
  checkedAt: string | null;
  result: Record<string, unknown> | null;
  failureReason: string | null;
  evidence: EvidenceDto[];
}

export interface ActivityDto {
  verifications: VerificationListItemDto[];
  audit: AuditEventDto[];
}

export interface DiscoverResultDto {
  discovered: number;
  classified: number;
  sources: string[];
  items: OpportunityDto[];
}

export type PlanRecommendation =
  'RECOMMENDED' | 'REVIEW_REQUIRED' | 'NOT_RECOMMENDED' | 'INSUFFICIENT_DATA';

export type PlanNextAction =
  | 'PREPARE_OUTREACH'
  | 'REQUEST_MANUAL_PLACEMENT'
  | 'EXECUTE_AUTOMATICALLY'
  | 'REVIEW_PROVIDER'
  | 'REVIEW_OPPORTUNITY'
  | 'REJECT';

export type PlanAutomationLevel = 'AUTOMATIC' | 'AI_ASSISTED' | 'HUMAN_REQUIRED';

export interface PlanRejectionReasonDto {
  kind: string;
  text: string;
}

export interface AnchorPlanRecommendationDto {
  anchorType: string;
  anchor: string;
  explanation: string;
}

export interface PlanItemDto {
  opportunityId: string;
  platformId: string;
  platformName: string;
  placementType: string;
  placementMethod: string;
  score: number | null;
  overallScore: number | null;
  donorQuality: number | null;
  riskLevel: string | null;
  providerAvailable: boolean;
  recommendation: PlanRecommendation;
  recommendationReason: string;
  nextAction: PlanNextAction;
  automationLevel: PlanAutomationLevel;
  riskExplanation: string | null;
  suggestedPlacementApproach: string | null;
  rejectionReason: PlanRejectionReasonDto | null;
  anchorRecommendation: AnchorPlanRecommendationDto | null;
}

export interface PlanSummaryDto {
  total: number;
  recommended: number;
  reviewRequired: number;
  notRecommended: number;
  insufficientData: number;
  automationPercent: number;
  byRejectionReason: string[];
}

export interface PlacementPlanDto {
  campaignId: string;
  generatedAt: string;
  provider: string;
  model: string | null;
  schemaVersion: string;
  summary: PlanSummaryDto;
  recommendedToStart: Array<{
    opportunityId: string;
    platformName: string;
    placementType: string;
  }>;
  items: PlanItemDto[];
}

export interface ApiErrorDto {
  error: { code: string; message: string };
}
