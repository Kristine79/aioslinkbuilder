export { createPrismaClient } from './db.js';

export {
  PrismaCompanyRepository,
  PrismaCampaignRepository,
  PrismaAuditLogRepository,
  PrismaLookupRepository,
  PrismaPlacementOpportunityRepository,
  PrismaAIAnalysisRepository,
  PrismaPlacementRepository,
  PrismaVerificationRepository,
  PrismaEvidenceRepository,
} from './repositories/index.js';

export {
  InMemoryCompanyRepository,
  InMemoryCampaignRepository,
  InMemoryAuditLogRepository,
  InMemoryPlacementOpportunityRepository,
  InMemoryLookupRepository,
  InMemoryAIAnalysisRepository,
  InMemoryPlacementRepository,
  InMemoryVerificationRepository,
  InMemoryEvidenceRepository,
} from './in-memory/index.js';
