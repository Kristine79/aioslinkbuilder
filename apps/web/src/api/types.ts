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

export interface ApiErrorDto {
  error: { code: string; message: string };
}
