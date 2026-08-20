/**
 * Delivery-layer DTOs and entity -> DTO mappers. This module is
 * presentation-only: it serializes domain state for the UI and derives
 * which UI actions are offered for the current state (the domain state
 * machine remains the only authority — the UI never decides transitions).
 */

import type {
  AIAnalysis,
  AnchorRecommendation,
  AuditLogEntry,
  Campaign,
  Company,
  DiscoveryRun,
  DonorQualityProfile,
  DonorRiskAssessment,
  Evidence,
  LinkInsertDraft,
  NegotiationSession,
  OutreachDraft,
  PageAnalysis,
  Placement,
  PlacementOpportunity,
  PlacementPlan,
  PlacementProvider,
  PlacementStatus,
  Platform,
  PlacementCategory,
  ScoreBreakdown,
  ScoreV2Components,
  Verification,
  WorkflowStage,
} from '@aios/domain';
import {
  EXECUTION_REQUIRED_CAPABILITIES,
  deriveHumanActions,
  selectBestProvider,
  supportsCapability,
  workflowCurrentStageKind,
  workflowForType,
} from '@aios/domain';
import type { OpportunityIntel } from '@aios/application';
import { readIntel } from '@aios/application';

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
  /** Catalog category id; null for AI-derived directions outside the catalog. */
  categoryId: string | null;
  categoryCode: string;
  categoryName: string;
  placementType: string;
  /** Opportunities already discovered for this category in the campaign. */
  opportunityCount: number;
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
  /** Which discovery source found this opportunity (catalog, search, …). */
  discoverySource: string | null;
  status: PlacementStatus;
  createdAt: string;
  updatedAt: string;
  allowedActions: OpportunityAction[];
  placements: ApiPlacementDto[];
  /** Donor quality profile (list-ready summary fields too). */
  donorQuality: DonorQualityProfile | null;
  donorQualityScore: number | null;
  pageAnalysis: PageAnalysis | null;
  risk: DonorRiskAssessment | null;
  scoreV2: ScoreV2Components | null;
  overallScore: number | null;
  linkInsert: LinkInsertDraft | null;
  anchorStrategy: AnchorRecommendation | null;
  outreach: OutreachDraft | null;
  negotiation: NegotiationSession | null;
  workflow: ApiWorkflowDto | null;
  humanActions: ApiHumanActionDto[];
  /** List summary: organic traffic value when known. */
  traffic: number | null;
  /** List summary: donor traffic geography when known. */
  geography: string[] | null;
  /** List summary: whether automatic/outreach execution is available. */
  automationAvailable: boolean;
}

export interface ApiWorkflowStageDto {
  kind: string;
  label: string;
  automated: boolean;
  hitl: boolean;
  required: boolean;
  current: boolean;
}

export interface ApiWorkflowDto {
  placementType: string;
  label: string;
  stages: ApiWorkflowStageDto[];
  currentStageKind: string | null;
}

export interface ApiHumanActionDto {
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

/**
 * Current product stage of a campaign, derived by the delivery layer from
 * persisted state (analysis, discovery run, opportunities/placements).
 * Presentation semantics only — no new business statuses.
 */
export type CampaignStage =
  | 'DRAFT'
  | 'SEARCH'
  | 'SEARCHING'
  | 'SEARCH_EMPTY'
  | 'SEARCH_FAILED'
  | 'REVIEW'
  | 'PREPARE'
  | 'PLACEMENT'
  | 'VERIFICATION'
  | 'COMPLETED';

export interface ApiCampaignCountsDto {
  opportunities: number;
  approved: number;
  executed: number;
  published: number;
  verified: number;
}

export interface ApiCampaignProgressDto {
  /** Valid company analysis exists for the campaign (strategy derives from it). */
  analysisDone: boolean;
  /** Placement plan was generated and persisted for the campaign. */
  planDone: boolean;
  discoveryStatus: ApiDiscoveryStateDto['status'];
}

export const EMPTY_CAMPAIGN_COUNTS: ApiCampaignCountsDto = {
  opportunities: 0,
  approved: 0,
  executed: 0,
  published: 0,
  verified: 0,
};

/**
 * Deterministic presentation mapping of persisted state to the current
 * product stage of a campaign. Pure and side-effect free; the state machine
 * and domain statuses remain the source of truth.
 */
export function deriveCampaignStage(
  progress: ApiCampaignProgressDto,
  counts: ApiCampaignCountsDto,
  campaignStatus: string,
): CampaignStage {
  if (campaignStatus === 'COMPLETED') return 'COMPLETED';
  if (!progress.analysisDone) return 'DRAFT';
  if (progress.discoveryStatus === 'RUNNING') return 'SEARCHING';
  if (progress.discoveryStatus === 'FAILED') return 'SEARCH_FAILED';
  if (progress.discoveryStatus === 'COMPLETED_EMPTY') return 'SEARCH_EMPTY';
  if (counts.opportunities === 0) return 'SEARCH';
  if (counts.published > 0) return 'VERIFICATION';
  if (counts.executed > 0) return 'PLACEMENT';
  if (progress.planDone) return 'PREPARE';
  return 'REVIEW';
}

export interface ApiCampaignListItemDto {
  id: string;
  companyId: string;
  name: string;
  goals: string[];
  status: string;
  createdAt: string;
  /** Valid company analysis exists (True after the analysis was generated). */
  analysisDone: boolean;
  /** Placement plan generated and persisted for the campaign. */
  planDone: boolean;
  discoveryStatus: ApiDiscoveryStateDto['status'];
  stage: CampaignStage;
  counts: ApiCampaignCountsDto;
}

export interface ApiCompanyListItemDto {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  description: string | null;
  createdAt: string;
  campaigns: ApiCampaignListItemDto[];
}

export interface ApiOverviewDto {
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
  manualActions: ApiManualActionDto[];
  humanActions: ApiHumanActionDto[];
  negotiations: Array<{
    opportunityId: string;
    platformName: string;
    outreachStatus: string | null;
    negotiationIntent: string | null;
  }>;
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

export interface ApiPlanRejectionReasonDto {
  kind: string;
  text: string;
}

export interface ApiAnchorPlanRecommendationDto {
  anchorType: string;
  anchor: string;
  explanation: string;
}

export interface ApiPlanItemDto {
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
  /** Provider type selected for execution (MOCK marks demo content). */
  providerType: string | null;
  recommendation: string;
  recommendationReason: string;
  nextAction: string;
  automationLevel: string;
  riskExplanation: string | null;
  suggestedPlacementApproach: string | null;
  rejectionReason: ApiPlanRejectionReasonDto | null;
  anchorRecommendation: ApiAnchorPlanRecommendationDto | null;
}

export interface ApiPlanSummaryDto {
  total: number;
  recommended: number;
  reviewRequired: number;
  notRecommended: number;
  insufficientData: number;
  automationPercent: number;
  byRejectionReason: string[];
}

export interface ApiPlacementPlanDto {
  campaignId: string;
  generatedAt: string;
  provider: string;
  model: string | null;
  schemaVersion: string;
  summary: ApiPlanSummaryDto;
  recommendedToStart: Array<{
    opportunityId: string;
    platformName: string;
    placementType: string;
  }>;
  items: ApiPlanItemDto[];
}

/** Server-side discovery state for a campaign: the backend is authoritative. */
export interface ApiDiscoveryStateDto {
  campaignId: string;
  status: 'NOT_RUN' | 'RUNNING' | 'COMPLETED_WITH_RESULTS' | 'COMPLETED_EMPTY' | 'FAILED';
  lastRunAt: string | null;
  discoveredCount: number;
  classifiedCount: number;
  sources: string[];
  failure: string | null;
}

export function mapDiscoveryState(
  run: DiscoveryRun | null,
  campaignId: string,
): ApiDiscoveryStateDto {
  if (run === null) {
    return {
      campaignId,
      status: 'NOT_RUN',
      lastRunAt: null,
      discoveredCount: 0,
      classifiedCount: 0,
      sources: [],
      failure: null,
    };
  }
  return {
    campaignId,
    status: run.status,
    lastRunAt: toIso(run.lastRunAt),
    discoveredCount: run.discoveredCount,
    classifiedCount: run.classifiedCount,
    sources: [...run.sources],
    failure: run.failure,
  };
}

/**
 * Serializes a campaign for lists with its presentation progress. `progress`
 * carries the persisted facts (analysis/plan/discovery); `null` means a fresh
 * campaign that has none yet. Counts come from the delivery layer.
 */
export function mapCampaignListItem(
  campaign: Campaign,
  progress: Pick<ApiCampaignProgressDto, 'analysisDone' | 'planDone' | 'discoveryStatus'> | null,
  counts: ApiCampaignCountsDto,
): ApiCampaignListItemDto {
  const normalized: ApiCampaignProgressDto =
    progress === null
      ? { analysisDone: false, planDone: false, discoveryStatus: 'NOT_RUN' }
      : progress;
  return {
    id: campaign.id,
    companyId: campaign.companyId,
    name: campaign.name,
    goals: [...campaign.goals],
    status: campaign.status,
    createdAt: toIso(campaign.createdAt),
    analysisDone: normalized.analysisDone,
    planDone: normalized.planDone,
    discoveryStatus: normalized.discoveryStatus,
    stage: deriveCampaignStage(normalized, counts, campaign.status),
    counts,
  };
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
export function opportunityActions(
  opportunity: PlacementOpportunity,
  intel?: OpportunityIntel,
  context?: Pick<OpportunityMapContext, 'envProviders'>,
): OpportunityAction[] {
  // Automatic execution is possible only when a provider capable of
  // CREATE+VERIFY is resolvable in the CURRENT environment. When the context
  // is available the check is resolved against the registry (which applies
  // the policy, e.g. MOCK_PROVIDERS=deny in production) so the UI can never
  // offer an action the backend — which resolves providers from the same
  // registry — would reject with NoProviderAvailableError. Without a context
  // the recorded classification capabilities are used (backwards compatible).
  const autoExecution = canExecuteAutomatically(opportunity, context);

  if (opportunity.status === 'QUALIFIED') {
    return ['approve'];
  }
  if (opportunity.status === 'SELECTED') {
    if (opportunity.placementMethod === 'OUTREACH') {
      // Outreach-driven placement: manual placement is offered only after the
      // negotiation reached AGREED; automatic execution never applies.
      return intel?.outreach?.status === 'AGREED' ? ['requestManual'] : [];
    }
    if (opportunity.placementMethod === 'MANUAL') {
      // Manual method: the manual gate is always available; automatic
      // execution is offered in addition when a CREATE+VERIFY provider is
      // resolvable in the current environment.
      const actions: OpportunityAction[] = ['requestManual'];
      if (autoExecution) actions.push('execute');
      return actions;
    }
    // API/BROWSER/SEMI_AUTOMATED/UNKNOWN methods: automatic execution when a
    // provider exists; otherwise the platform is still a valid manual target —
    // a human places it off-app and records the proof (NEEDS_MANUAL). The
    // platform is neither lost nor treated as an error.
    if (autoExecution) return ['execute'];
    return ['requestManual'];
  }
  // READY: a retry after a failed attempt is possible only while the automatic
  // provider is still resolvable; without it, offering execute would be a
  // guaranteed NO_PROVIDER error (failed attempts stay in the audit trail).
  if (opportunity.status === 'READY') {
    return autoExecution ? ['execute'] : [];
  }
  if (opportunity.status === 'NEEDS_MANUAL' && intel?.outreach?.status === 'AGREED') {
    return [];
  }
  return [];
}

/**
 * Resolves whether automatic execution is possible for the platform right now.
 *
 * Single source of truth: when the delivery context is provided, the same
 * provider set the execution use cases resolve from is used (registry policy
 * applied). When omitted, the capabilities recorded at classification time are
 * used so direct callers keep working.
 */
function canExecuteAutomatically(
  opportunity: PlacementOpportunity,
  context?: Pick<OpportunityMapContext, 'envProviders'>,
): boolean {
  if (context === undefined) {
    return EXECUTION_REQUIRED_CAPABILITIES.every((capability) =>
      supportsCapability(opportunity.providerCapabilities, capability),
    );
  }
  const platformProviders = context.envProviders.filter(
    (provider) => provider.platformId === opportunity.platformId,
  );
  return selectBestProvider(platformProviders, EXECUTION_REQUIRED_CAPABILITIES) !== null;
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
  const metadata = opportunity.metadata ?? {};
  const discoverySource =
    typeof metadata.discoverySource === 'string' ? metadata.discoverySource : null;
  const intel = readIntel(opportunity.metadata);
  const donorQualityScore = intel.donorQuality?.overallDonorQuality ?? null;
  const traffic =
    intel.donorQuality?.organicTraffic.value !== null &&
    typeof intel.donorQuality?.organicTraffic.value === 'number'
      ? intel.donorQuality.organicTraffic.value
      : null;
  const geography = intel.donorQuality?.trafficGeography.value ?? null;
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
    discoverySource,
    status: opportunity.status,
    createdAt: toIso(opportunity.createdAt),
    updatedAt: toIso(opportunity.updatedAt),
    allowedActions: opportunityActions(opportunity, intel, context),
    placements: placements.map((placement) =>
      mapPlacement(placement, verificationsByPlacement, evidenceByVerification, context.maps),
    ),
    donorQuality: intel.donorQuality,
    donorQualityScore,
    pageAnalysis: intel.pageAnalysis,
    risk: intel.risk,
    scoreV2: intel.scoreV2,
    overallScore: intel.scoreV2?.overall ?? null,
    linkInsert: intel.linkInsert,
    anchorStrategy: intel.anchorStrategy,
    outreach: intel.outreach,
    negotiation: intel.negotiation,
    workflow: mapWorkflow(opportunity, intel),
    humanActions: mapHumanActions(opportunity, intel, placements),
    traffic,
    geography,
    automationAvailable: automationAvailability(opportunity),
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

/** Serializes the placement-type workflow and highlights the current stage. */
function mapWorkflow(opportunity: PlacementOpportunity, intel: OpportunityIntel): ApiWorkflowDto {
  const workflow = workflowForType(opportunity.placementType);
  const currentKind = workflowCurrentStageKind(
    opportunity.placementType,
    opportunity.status,
    intel.outreach?.status ?? null,
  );
  return {
    placementType: workflow.placementType,
    label: workflow.label,
    stages: workflow.stages.map((stage: WorkflowStage) => ({
      kind: stage.kind,
      label: stage.label,
      automated: stage.automated,
      hitl: stage.hitl,
      required: stage.required,
      current: stage.kind === currentKind,
    })),
    currentStageKind: currentKind,
  };
}

/** Serializes the deterministic human-in-the-loop actions. */
function mapHumanActions(
  opportunity: PlacementOpportunity,
  intel: OpportunityIntel,
  placements: readonly Placement[],
): ApiHumanActionDto[] {
  const manualPlacements = placements
    .filter((placement) => placement.status === 'NEEDS_MANUAL')
    .map((placement) => ({
      id: placement.id,
      reason: typeof placement.metadata?.reason === 'string' ? placement.metadata.reason : null,
    }));
  const items = deriveHumanActions({
    opportunityId: opportunity.id,
    opportunityStatus: opportunity.status,
    placementMethod: opportunity.placementMethod,
    placementType: opportunity.placementType,
    risk: intel.risk,
    hasIntel: intel.donorQuality !== null || intel.pageAnalysis !== null,
    outreach: intel.outreach,
    negotiation: intel.negotiation,
    manualPlacements,
  });
  return items.map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    why: item.why,
    aiPrepared: item.aiPrepared,
    humanTask: item.humanTask,
    actionLabel: item.actionLabel,
    opportunityId: item.opportunityId,
    placementId: item.placementId,
  }));
}

/** Whether automatic or outreach execution is available for the opportunity. */
function automationAvailability(opportunity: PlacementOpportunity): boolean {
  if (opportunity.placementMethod === 'OUTREACH') {
    return true;
  }
  return opportunity.placementMethod === 'API' || opportunity.placementMethod === 'BROWSER';
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

/** Serializes the AI placement plan for the UI. */
export function mapPlacementPlan(plan: PlacementPlan): ApiPlacementPlanDto {
  return {
    campaignId: plan.campaignId,
    generatedAt: toIso(plan.generatedAt),
    provider: plan.provider,
    model: plan.model,
    schemaVersion: plan.schemaVersion,
    summary: {
      total: plan.summary.total,
      recommended: plan.summary.recommended,
      reviewRequired: plan.summary.reviewRequired,
      notRecommended: plan.summary.notRecommended,
      insufficientData: plan.summary.insufficientData,
      automationPercent: plan.summary.automationPercent,
      byRejectionReason: [...plan.summary.byRejectionReason],
    },
    recommendedToStart: plan.recommendedToStart.map((item) => ({
      opportunityId: item.opportunityId,
      platformName: item.platformName,
      placementType: item.placementType,
    })),
    items: plan.items.map((item) => ({
      opportunityId: item.opportunityId,
      platformId: item.platformId,
      platformName: item.platformName,
      placementType: item.placementType,
      placementMethod: item.placementMethod,
      score: item.score,
      overallScore: item.overallScore,
      donorQuality: item.donorQuality,
      riskLevel: item.riskLevel,
      providerAvailable: item.providerAvailable,
      providerType: item.providerType,
      recommendation: item.decision.recommendation,
      recommendationReason: item.decision.recommendationReason,
      nextAction: item.decision.nextAction,
      automationLevel: item.decision.automationLevel,
      riskExplanation: item.decision.riskExplanation,
      suggestedPlacementApproach: item.decision.suggestedPlacementApproach,
      rejectionReason:
        item.decision.rejectionReason === null
          ? null
          : {
              kind: item.decision.rejectionReason.kind,
              text: item.decision.rejectionReason.text,
            },
      anchorRecommendation:
        item.anchorRecommendation === null
          ? null
          : {
              anchorType: item.anchorRecommendation.anchorType,
              anchor: item.anchorRecommendation.anchor,
              explanation: item.anchorRecommendation.explanation,
            },
    })),
  };
}
