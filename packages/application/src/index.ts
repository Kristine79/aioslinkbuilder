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

export type { CompanyRepository, CampaignRepository };
export type { PlacementOpportunityRepository, PlacementRepository };
export type { VerificationRepository, AIAnalysisRepository, AuditLogRepository };
export type { AuditLogDraft, AIAnalysisDraft };
export type { LookupRepository };

export { NotFoundError, NoCompanyAnalysisError } from './errors.js';

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
