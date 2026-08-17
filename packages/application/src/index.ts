import type { CompanyRepository } from './ports/repositories/company.repository.js';
import type { CampaignRepository } from './ports/repositories/campaign.repository.js';
import type { PlacementOpportunityRepository } from './ports/repositories/opportunity.repository.js';
import type { PlacementRepository } from './ports/repositories/placement.repository.js';
import type { VerificationRepository } from './ports/repositories/verification.repository.js';
import type { AIAnalysisRepository } from './ports/repositories/ai-analysis.repository.js';
import type { AuditLogRepository } from './ports/repositories/audit-log.repository.js';
import type { LookupRepository } from './ports/repositories/lookup.repository.js';

export type { CompanyRepository, CampaignRepository };
export type { PlacementOpportunityRepository, PlacementRepository };
export type { VerificationRepository, AIAnalysisRepository, AuditLogRepository };
export type { LookupRepository };
