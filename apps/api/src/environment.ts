/**
 * The shared environment contract used by the delivery layer.
 *
 * Every composition root (in-memory Nordhaus demo, Prisma-backed
 * production environment) must provide these capabilities. The concrete
 * repository classes stay behind the application ports; the delivery layer
 * never depends on a specific implementation.
 */

import type { AIProvider } from '@aios/ai';
import type {
  AIAnalysisRepository,
  AuditLogRepository,
  CampaignRepository,
  CompanyRepository,
  EvidenceRepository,
  LookupRepository,
  OutreachProvider,
  PageAnalysisProvider,
  PlacementOpportunityRepository,
  PlacementProviderRegistry,
  PlacementRepository,
  PlatformDiscoverySource,
  SeoMetricsProvider,
  VerificationRepository,
} from '@aios/application';

export interface ApiEnvironment {
  companies: CompanyRepository;
  campaigns: CampaignRepository;
  lookups: LookupRepository;
  opportunities: PlacementOpportunityRepository;
  placements: PlacementRepository;
  verifications: VerificationRepository;
  evidence: EvidenceRepository;
  analyses: AIAnalysisRepository;
  auditLog: AuditLogRepository;
  registry: PlacementProviderRegistry;
  ai: AIProvider;
  seoMetrics: SeoMetricsProvider | null;
  pageAnalysis: PageAnalysisProvider;
  outreach: OutreachProvider;
  /** The discovery sources used by the /api/discover route. */
  discoverySources: PlatformDiscoverySource[];
}
