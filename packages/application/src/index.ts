import type { CompanyRepository } from './ports/repositories/company.repository.js';
import type { CampaignRepository } from './ports/repositories/campaign.repository.js';
import type { PlacementOpportunityRepository } from './ports/repositories/opportunity.repository.js';
import type { PlacementRepository } from './ports/repositories/placement.repository.js';
import type { VerificationRepository } from './ports/repositories/verification.repository.js';
import type { AIAnalysisRepository } from './ports/repositories/ai-analysis.repository.js';
import type {
  AuditLogRepository,
  AuditLogDraft,
} from './ports/repositories/audit-log.repository.js';
import type { AIAnalysisDraft } from './ports/repositories/ai-analysis.repository.js';
import type { LookupRepository } from './ports/repositories/lookup.repository.js';
import type {
  EvidenceRepository,
  EvidenceDraft,
} from './ports/repositories/evidence.repository.js';
import type {
  PlatformDiscoverySource,
  DiscoverySourceInput,
  DiscoveryCandidate,
  DiscoverySourceResult,
} from './ports/discovery-sources.js';
import type { PlacementProviderRegistry } from './ports/provider-registry.js';
import type { SeoMetricsProvider, SeoMetricsSnapshot } from './ports/seo-metrics-provider.js';
import type { PageAnalysisProvider } from './ports/page-analysis-provider.js';
import type { OutreachProvider, OutreachSendResult } from './ports/outreach-provider.js';

export type { CompanyRepository, CampaignRepository };
export type { PlacementOpportunityRepository, PlacementRepository };
export type { VerificationRepository, AIAnalysisRepository, AuditLogRepository };
export type { AuditLogDraft, AIAnalysisDraft, EvidenceDraft };
export type { LookupRepository, EvidenceRepository };
export type { PlacementProviderRegistry };
export type { SeoMetricsProvider, SeoMetricsSnapshot };
export type { PageAnalysisProvider };
export type { OutreachProvider, OutreachSendResult };
export type {
  PlatformDiscoverySource,
  DiscoverySourceInput,
  DiscoveryCandidate,
  DiscoverySourceResult,
};

export {
  NotFoundError,
  NoCompanyAnalysisError,
  NoProviderAvailableError,
  NoProviderAssignedError,
} from './errors.js';

export type {
  CreateCompanyCommand,
  UpdateCompanyCommand,
  UpdateCompanyFields,
} from './dtos/company-commands.js';
export type {
  CreateCampaignCommand,
  UpdateCampaignCommand,
  UpdateCampaignFields,
} from './dtos/campaign-commands.js';

export { CreateCompanyUseCase } from './use-cases/company/create-company.use-case.js';
export { UpdateCompanyUseCase } from './use-cases/company/update-company.use-case.js';
export { GetCompanyUseCase } from './use-cases/company/get-company.use-case.js';
export { CreateCampaignUseCase } from './use-cases/campaign/create-campaign.use-case.js';
export { UpdateCampaignUseCase } from './use-cases/campaign/update-campaign.use-case.js';
export { GetCampaignUseCase } from './use-cases/campaign/get-campaign.use-case.js';
export { ListCampaignsByCompanyUseCase } from './use-cases/campaign/list-campaigns-by-company.use-case.js';
export { DiscoverOpportunitiesUseCase } from './use-cases/opportunity/discover-opportunities.use-case.js';
export { ClassifyOpportunityUseCase } from './use-cases/opportunity/classify-opportunity.use-case.js';
export type {
  DiscoverOpportunitiesCommand,
  ClassifyOpportunityCommand,
  DeterministicScoreInputs,
} from './dtos/opportunity-commands.js';
export type {
  AnalyzeCompanyCommand,
  GeneratePlacementStrategyCommand,
} from './dtos/analysis-commands.js';
export type {
  ApproveOpportunityCommand,
  ExecutePlacementCommand,
  MonitorPlacementCommand,
  VerifyPlacementCommand,
} from './dtos/placement-commands.js';
export type {
  RequestManualPlacementCommand,
  CompleteManualPlacementCommand,
} from './dtos/manual-placement-commands.js';

export { AnalyzeCompanyUseCase } from './use-cases/analysis/analyze-company.use-case.js';
export { GeneratePlacementStrategyUseCase } from './use-cases/analysis/generate-placement-strategy.use-case.js';
export { CatalogPlatformDiscoverySource } from './use-cases/opportunity/catalog-platform-discovery-source.js';
export { SearchPlatformDiscoverySource } from './use-cases/opportunity/search-platform-discovery-source.js';
export { ApproveOpportunityUseCase } from './use-cases/placement/approve-opportunity.use-case.js';
export { ExecutePlacementUseCase } from './use-cases/placement/execute-placement.use-case.js';
export { MonitorPlacementUseCase } from './use-cases/placement/monitor-placement.use-case.js';
export { VerifyPlacementUseCase } from './use-cases/placement/verify-placement.use-case.js';
export { RequestManualPlacementUseCase } from './use-cases/placement/request-manual-placement.use-case.js';
export { CompleteManualPlacementUseCase } from './use-cases/placement/complete-manual-placement.use-case.js';
export type { VerifyPlacementResult } from './use-cases/placement/verify-placement.use-case.js';

export type { OpportunityIntel } from './intel/metadata.js';
export { readIntel, writeIntel, emptyIntel } from './intel/metadata.js';
export type { OpportunityContext } from './intel/context.js';
export { loadOpportunityContext } from './intel/context.js';

export { AssessOpportunityUseCase } from './use-cases/intel/assess-opportunity.use-case.js';
export type { AssessOpportunityCommand } from './use-cases/intel/assess-opportunity.use-case.js';
export { GenerateLinkInsertUseCase } from './use-cases/intel/generate-link-insert.use-case.js';
export type { GenerateLinkInsertCommand } from './use-cases/intel/generate-link-insert.use-case.js';
export { RecommendAnchorUseCase } from './use-cases/intel/recommend-anchor.use-case.js';
export type { RecommendAnchorCommand } from './use-cases/intel/recommend-anchor.use-case.js';
export { GenerateOutreachUseCase } from './use-cases/intel/generate-outreach.use-case.js';
export type { GenerateOutreachCommand } from './use-cases/intel/generate-outreach.use-case.js';
export { UpdateOutreachStatusUseCase } from './use-cases/intel/update-outreach-status.use-case.js';
export type { UpdateOutreachStatusCommand } from './use-cases/intel/update-outreach-status.use-case.js';
export { AnalyzeNegotiationReplyUseCase } from './use-cases/intel/analyze-negotiation-reply.use-case.js';
export type { AnalyzeNegotiationReplyCommand } from './use-cases/intel/analyze-negotiation-reply.use-case.js';
export { RespondNegotiationUseCase } from './use-cases/intel/respond-negotiation.use-case.js';
export type { RespondNegotiationCommand } from './use-cases/intel/respond-negotiation.use-case.js';
