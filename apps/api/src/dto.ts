/**
 * Delivery-layer DTOs and entity -> DTO mappers. This module is
 * presentation-only: it serializes domain state for the UI and derives
 * which UI actions are offered for the current state (the domain state
 * machine remains the only authority — the UI never decides transitions).
 */

import type {
  AIAnalysis,
  AuditLogEntry,
  Company,
  Evidence,
  Placement,
  PlacementOpportunity,
  PlacementProvider,
  PlacementStatus,
  Platform,
  PlacementCategory,
  ScoreBreakdown,
  Verification,
} from '@aios/domain';
import { EXECUTION_REQUIRED_CAPABILITIES, selectBestProvider } from '@aios/domain';

export type OpportunityAction = 'approve' | 'execute' | 'requestManual';
export type PlacementAction = 'monitor' | 'verify' | 'completeManual';

export interface ApiCategoryDto {
  id: string;
  code: string;
  name: string;
}

export interface ApiCompanyAnalysisDto {
  provider: string;
  model: string | null;
  createdAt: string;
  businessType: string;
  topics: string[];
  audiences: string[];
  relevantCategories: string[];
  strategicRecommendations: string[];
}

export interface ApiCompanyDto {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  website: string | null;
  geography: string[];
  locations: string[];
  products: string[];
  targetAudience: string[];
  analysis: ApiCompanyAnalysisDto | null;
}

export interface ApiStrategyItemDto {
  categoryCode: string;
  categoryName: string;
  placementType: string;
}

export interface ApiProviderDto {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  capabilitiesVerified: boolean;
}

export interface ApiEvidenceDto {
  id: string;
  type: string;
  url: string | null;
  content: string | null;
  metadata: Readonly<Record<string, unknown>> | null;
  createdAt: string;
}

export interface ApiVerificationDto {
  id: string;
  status: 'PENDING' | 'PASSED' | 'FAILED';
  checkedAt: string | null;
  result: Readonly<Record<string, unknown>> | null;
  failureReason: string | null;
  createdAt: string;
}

export interface ApiPlacementDto {
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
  verification: ApiVerificationDto | null;
  evidence: ApiEvidenceDto[];
  allowedActions: PlacementAction[];
}

export interface ApiOpportunityDto {
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
  scoreBreakdown: ScoreBreakdown | null;
  recommendation: string | null;
  whyRecommended: string | null;
  placementMethod: string;
  providerCapabilities: string[];
  provider: ApiProviderDto | null;
  status: PlacementStatus;
  createdAt: string;
  updatedAt: string;
  allowedActions: OpportunityAction[];
  placements: ApiPlacementDto[];
}

export interface ApiAuditEventDto {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Readonly<Record<string, unknown>> | null;
}

export interface ApiManualActionDto {
  placementId: string;
  opportunityId: string;
  platformId: string;
  platformName: string;
  reason: string;
}

export interface ApiOverviewDto {
  company: { id: string; name: string; industry: string | null; website: string | null };
  campaign: { id: string; name: string; goals: string[]; status: string };
  counts: {
    opportunities: number;
    recommended: number;
    approved: number;
    executed: number;
    published: number;
    verified: number;
    failed: number;
    manual: number;
  };
  totalPlacements: number;
  funnel: Array<{ stage: string; count: number }>;
  manualActions: ApiManualActionDto[];
  recentActivity: ApiAuditEventDto[];
}

export interface ApiVerificationListItemDto {
  id: string;
  placementId: string;
  platformName: string;
  platformUrl: string | null;
  placementStatus: PlacementStatus;
  verificationStatus: 'PENDING' | 'PASSED' | 'FAILED';
  checkedAt: string | null;
  result: Readonly<Record<string, unknown>> | null;
  failureReason: string | null;
  evidence: ApiEvidenceDto[];
}

export interface ApiActivityDto {
  verifications: ApiVerificationListItemDto[];
  audit: ApiAuditEventDto[];
}

export interface ApiErrorDto {
  error: { code: string; message: string };
}

interface LookupMaps {
  platformById: ReadonlyMap<string, Platform>;
  categoryById: ReadonlyMap<string, PlacementCategory>;
  providerById: ReadonlyMap<string, PlacementProvider>;
}

export function buildLookupMaps(
  platforms: readonly Platform[],
  categories: readonly PlacementCategory[],
  providers: readonly PlacementProvider[],
): LookupMaps {
  return {
    platformById: new Map(platforms.map((platform) => [platform.id, platform])),
    categoryById: new Map(categories.map((category) => [category.id, category])),
    providerById: new Map(providers.map((provider) => [provider.id, provider])),
  };
}

/** Presentation gate: which opportunity-level actions the UI may offer. */
export function opportunityActions(opportunity: PlacementOpportunity): OpportunityAction[] {
  if (opportunity.status === 'QUALIFIED') {
    return ['approve'];
  }
  if (opportunity.status === 'SELECTED') {
    return opportunity.placementMethod === 'MANUAL' ? ['requestManual', 'execute'] : ['execute'];
  }
  // READY: a retry after a failed attempt is possible (a fresh placement is
  // created; failed attempts stay in the audit trail).
  if (opportunity.status === 'READY') {
    return ['execute'];
  }
  return [];
}

/** Presentation gate: which placement-level actions the UI may offer. */
export function placementActions(placement: Placement): PlacementAction[] {
  const actions: PlacementAction[] = [];
  if (placement.status === 'SUBMITTED' || placement.status === 'PENDING_PUBLICATION') {
    actions.push('monitor');
  }
  if (placement.status === 'PUBLISHED') {
    actions.push('verify');
  }
  if (placement.status === 'NEEDS_MANUAL') {
    actions.push('completeManual');
  }
  return actions;
}

export function toIso(value: Date): string {
  return value.toISOString();
}

export function toIsoNullable(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

export function mapCompany(company: Company, analysis: AIAnalysis | null): ApiCompanyDto {
  return {
    id: company.id,
    name: company.name,
    description: company.description,
    industry: company.industry,
    website: company.website,
    geography: [...company.geography],
    locations: [...company.locations],
    products: [...company.products],
    targetAudience: [...company.targetAudience],
    analysis: analysis === null ? null : mapCompanyAnalysis(analysis),
  };
}

/**
 * structuredOutput was validated against the CompanyAnalysis schema by the
 * ai layer before persistence, so the cast is safe.
 */
export function mapCompanyAnalysis(analysis: AIAnalysis): ApiCompanyAnalysisDto {
  const output = analysis.structuredOutput as {
    businessType?: unknown;
    topics?: unknown;
    audiences?: unknown;
    relevantCategories?: unknown;
    strategicRecommendations?: unknown;
  };
  return {
    provider: analysis.provider,
    model: analysis.model,
    createdAt: toIso(analysis.createdAt),
    businessType: typeof output.businessType === 'string' ? output.businessType : '',
    topics: stringList(output.topics),
    audiences: stringList(output.audiences),
    relevantCategories: stringList(output.relevantCategories),
    strategicRecommendations: stringList(output.strategicRecommendations),
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

export function mapProvider(provider: PlacementProvider): ApiProviderDto {
  return {
    id: provider.id,
    name: provider.name,
    type: provider.providerType,
    capabilities: [...provider.capabilities],
    capabilitiesVerified: provider.capabilitiesVerified,
  };
}

export interface OpportunityMapContext {
  maps: LookupMaps;
  envProviders: readonly PlacementProvider[];
}

export function mapOpportunity(
  opportunity: PlacementOpportunity,
  placements: readonly Placement[],
  verificationsByPlacement: ReadonlyMap<string, readonly Verification[]>,
  evidenceByVerification: ReadonlyMap<string, readonly Evidence[]>,
  context: OpportunityMapContext,
): ApiOpportunityDto {
  const platform = context.maps.platformById.get(opportunity.platformId);
  const category =
    opportunity.categoryId === null
      ? undefined
      : context.maps.categoryById.get(opportunity.categoryId);
  const candidateProvider = candidateForDisplay(opportunity, context);
  return {
    id: opportunity.id,
    campaignId: opportunity.campaignId,
    platformId: opportunity.platformId,
    platformName: platform?.name ?? opportunity.platformId,
    platformUrl: platform?.url ?? null,
    country: platform?.country ?? null,
    categoryId: opportunity.categoryId,
    categoryCode: category?.code ?? null,
    categoryName: category?.name ?? null,
    placementType: opportunity.placementType,
    relevance: opportunity.relevance,
    score: opportunity.score,
    scoreBreakdown: opportunity.scoreBreakdown,
    recommendation: opportunity.recommendation,
    whyRecommended: opportunity.whyRecommended,
    placementMethod: opportunity.placementMethod,
    providerCapabilities: [...opportunity.providerCapabilities],
    provider: candidateProvider,
    status: opportunity.status,
    createdAt: toIso(opportunity.createdAt),
    updatedAt: toIso(opportunity.updatedAt),
    allowedActions: opportunityActions(opportunity),
    placements: placements.map((placement) =>
      mapPlacement(placement, verificationsByPlacement, evidenceByVerification, context.maps),
    ),
  };
}

export function mapPlacement(
  placement: Placement,
  verificationsByPlacement: ReadonlyMap<string, readonly Verification[]>,
  evidenceByVerification: ReadonlyMap<string, readonly Evidence[]>,
  maps: LookupMaps,
): ApiPlacementDto {
  const provider =
    placement.providerId === null ? undefined : maps.providerById.get(placement.providerId);
  const verifications = verificationsByPlacement.get(placement.id) ?? [];
  const latestVerification = lastOf(verifications);
  const metadata = placement.metadata ?? {};
  const manualReason = typeof metadata.reason === 'string' ? metadata.reason : '';
  const manualNotes = typeof metadata.notes === 'string' ? metadata.notes : null;
  const verification =
    latestVerification === undefined ? null : mapVerification(latestVerification);
  return {
    id: placement.id,
    opportunityId: placement.opportunityId,
    providerId: placement.providerId,
    providerName: provider?.name ?? null,
    providerType: provider?.providerType ?? null,
    status: placement.status,
    externalId: placement.externalId,
    submittedAt: toIsoNullable(placement.submittedAt),
    publishedAt: toIsoNullable(placement.publishedAt),
    liveUrl: placement.liveUrl,
    createdAt: toIso(placement.createdAt),
    updatedAt: toIso(placement.updatedAt),
    manual: manualReason === '' ? null : { reason: manualReason, notes: manualNotes },
    verification,
    evidence:
      verification === null
        ? []
        : (evidenceByVerification.get(verification.id) ?? []).map(mapEvidence),
    allowedActions: placementActions(placement),
  };
}

export function mapVerification(verification: Verification): ApiVerificationDto {
  return {
    id: verification.id,
    status: verification.status,
    checkedAt: toIsoNullable(verification.checkedAt),
    result: verification.result,
    failureReason: verification.failureReason,
    createdAt: toIso(verification.createdAt),
  };
}

export function mapEvidence(evidence: Evidence): ApiEvidenceDto {
  return {
    id: evidence.id,
    type: evidence.type,
    url: evidence.url,
    content: evidence.content,
    metadata: evidence.metadata,
    createdAt: toIso(evidence.createdAt),
  };
}

export function mapAuditEvent(entry: AuditLogEntry): ApiAuditEventDto {
  return {
    id: entry.id,
    timestamp: toIso(entry.timestamp),
    actor: entry.actor,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.metadata,
  };
}

function lastOf<T>(items: readonly T[]): T | undefined {
  return items.length === 0 ? undefined : items[items.length - 1];
}

/**
 * Display-only candidate provider: the same deterministic domain alignment
 * that ExecutePlacement uses (single source of truth). Null when no usable
 * provider exists for the platform.
 */
function candidateForDisplay(
  opportunity: PlacementOpportunity,
  context: OpportunityMapContext,
): ApiProviderDto | null {
  const platformProviders = context.envProviders.filter(
    (provider) => provider.platformId === opportunity.platformId,
  );
  const candidate = selectBestProvider(
    platformProviders,
    opportunity.placementMethod === 'MANUAL' ? ['VERIFY'] : EXECUTION_REQUIRED_CAPABILITIES,
  );
  return candidate === null ? null : mapProvider(candidate);
}
