/**
 * Production environment: Prisma-backed repositories over PostgreSQL (Neon).
 *
 * This is the persistence composition root used by the Vercel serverless
 * entry and `pnpm start`. Unlike the Nordhaus demo environment it never
 * seeds synthetic companies/campaigns — real data is created by the user
 * through the API/UI (the catalog/platform/provider lookups are loaded once
 * via `pnpm db:seed` and are required at startup).
 *
 * The provider registry stays in-memory (MockProvider implementations) until
 * real platform integrations exist; provider entity records come from the
 * database so alignment/classification reads live data (ADR-012).
 */

import { OpenCodeAIProvider, AISearchClient } from '@aios/ai';
import type { AIProvider } from '@aios/ai';
import {
  CatalogPlatformDiscoverySource,
  SearchPlatformDiscoverySource,
  WebSearchPlatformDiscoverySource,
} from '@aios/application';
import type { PlatformDiscoverySource, SeoMetricsProvider } from '@aios/application';
import type { PageAnalysisProvider, OutreachProvider } from '@aios/application';
import {
  AIBackedSearchQueryGenerator,
  DeterministicSearchQueryGenerator,
} from '@aios/application';
import {
  AISearchCitationsProvider,
  DuckDuckGoSearchProvider,
  HttpPageAnalysisProvider,
  InMemoryPlacementProviderRegistry,
  MockPlacementProvider,
} from '@aios/integrations';
import {
  createPrismaClient,
  PrismaAIAnalysisRepository,
  PrismaAuditLogRepository,
  PrismaCampaignRepository,
  PrismaCompanyRepository,
  PrismaEvidenceRepository,
  PrismaLookupRepository,
  PrismaPlacementOpportunityRepository,
  PrismaPlacementRepository,
  PrismaVerificationRepository,
} from '@aios/infrastructure';
import type { PlacementProvider } from '@aios/domain';

import type { ApiEnvironment } from './environment.js';
import { loadRuntimeConfig, openCodeProviderConfig, type RuntimeConfig } from './runtime-config.js';
import {
  NORDHAUS_CORE_PLATFORM_IDS,
  NORDHAUS_SEARCH_PLATFORM_IDS,
} from './scenario/nordhaus-fixtures.js';
import {
  ScenarioOutreachProvider,
  ScenarioPageAnalysisProvider,
  ScenarioSeoMetricsProvider,
} from './scenario/nordhaus-intel.js';
import { ScenarioAIProvider } from './scenario/nordhaus-fixtures.js';

const DB_CONNECT_TIMEOUT_MS = 15_000;

export type PrismaEnvironment = ApiEnvironment & {
  /** Exposed for graceful shutdown; not part of the delivery contract. */
  db: ReturnType<typeof createPrismaClient>;
};

export async function createPrismaEnvironment(
  config: RuntimeConfig = loadRuntimeConfig(),
): Promise<PrismaEnvironment> {
  const db = createPrismaClient();
  try {
    await withTimeout(db.$queryRaw`SELECT 1`, DB_CONNECT_TIMEOUT_MS);
  } catch (error) {
    await db.$disconnect().catch(() => undefined);
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(
      `PostgreSQL (Neon) is unreachable. Set DATABASE_URL/DIRECT_URL and run ` +
        `pnpm db:migrate && pnpm db:seed. Underlying error: ${cause}`,
    );
  }

  const companies = new PrismaCompanyRepository(db);
  const campaigns = new PrismaCampaignRepository(db);
  const lookups = new PrismaLookupRepository(db);
  const opportunities = new PrismaPlacementOpportunityRepository(db);
  const placements = new PrismaPlacementRepository(db);
  const verifications = new PrismaVerificationRepository(db);
  const evidence = new PrismaEvidenceRepository(db);
  const analyses = new PrismaAIAnalysisRepository(db);
  const auditLog = new PrismaAuditLogRepository(db);

  const providerConfig = openCodeProviderConfig(config);
  const openCodeProvider = providerConfig !== null ? new OpenCodeAIProvider(providerConfig) : null;

  let ai: AIProvider;
  let seoMetrics: SeoMetricsProvider | null;
  let pageAnalysis: PageAnalysisProvider;
  if (config.aiMode === 'real' && openCodeProvider !== null) {
    ai = openCodeProvider;
    // Real mode has no paid SEO metrics source: every metric stays UNKNOWN
    // (honest "no data" instead of synthetic values).
    seoMetrics = null;
    pageAnalysis = new HttpPageAnalysisProvider({ timeoutMs: 8000 });
  } else {
    ai = new ScenarioAIProvider();
    seoMetrics = new ScenarioSeoMetricsProvider();
    pageAnalysis = new ScenarioPageAnalysisProvider();
  }
  const outreach: OutreachProvider = new ScenarioOutreachProvider();

  const [categories, platforms, providers] = await Promise.all([
    lookups.listCategories(),
    lookups.listPlatforms(),
    lookups.listProviders(),
  ]);
  if (categories.length === 0 || platforms.length === 0) {
    throw new Error(
      'Platform catalog is empty. Run `pnpm db:seed` to load categories, platforms and providers.',
    );
  }
  const registry = buildRegistry(providers);

  let discoverySources: PlatformDiscoverySource[];
  if (config.discoveryMode === 'real') {
    const queryGenerator =
      openCodeProvider !== null
        ? new AIBackedSearchQueryGenerator(openCodeProvider)
        : new DeterministicSearchQueryGenerator();
    const searchProvider =
      config.discoveryProvider === 'ai-search' && config.aiSearch !== null
        ? new AISearchCitationsProvider(
            new AISearchClient({
              apiKey: config.aiSearch.apiKey,
              baseUrl: config.aiSearch.baseUrl,
              model: config.aiSearch.model,
              capabilities: config.aiSearch.capabilities,
              timeoutMs: config.aiSearch.timeoutMs,
            }),
          )
        : new DuckDuckGoSearchProvider();
    discoverySources = [
      new WebSearchPlatformDiscoverySource(lookups, searchProvider, queryGenerator, {
        maxQueries: config.discoveryLimits.maxQueries,
        maxResultsPerQuery: config.discoveryLimits.maxResultsPerQuery,
        maxCandidates: config.discoveryLimits.maxCandidates,
        concurrency: config.discoveryLimits.concurrency,
      }),
    ];
  } else {
    const searchPlatforms = platforms.filter((platform) =>
      NORDHAUS_SEARCH_PLATFORM_IDS.includes(platform.id),
    );
    discoverySources = [
      new CatalogPlatformDiscoverySource(lookups, NORDHAUS_CORE_PLATFORM_IDS),
      new SearchPlatformDiscoverySource(searchPlatforms, categories),
    ];
  }

  return {
    companies,
    campaigns,
    lookups,
    opportunities,
    placements,
    verifications,
    evidence,
    analyses,
    auditLog,
    registry,
    ai,
    seoMetrics,
    pageAnalysis,
    outreach,
    discoverySources,
    db,
  };
}

/**
 * Binds provider entity records (from the database) to the executable
 * MockProvider implementations. Scenario tweaks (2GIS timeline, Archi.ru
 * first-create failure) are keyed by provider id, matching the Prisma seed.
 */
function buildRegistry(
  providers: readonly PlacementProvider[],
): InMemoryPlacementProviderRegistry {
  const mockProviders = providers.filter(
    (provider) => provider.providerType === 'MOCK' || provider.providerType === 'MANUAL',
  );
  const bindings = new Map<string, MockPlacementProvider>();
  for (const provider of mockProviders) {
    let options: ConstructorParameters<typeof MockPlacementProvider>[2] = undefined;
    if (provider.id === 'provider-2gis-mock') {
      options = { timeline: ['pending_publication', 'published'] };
    }
    if (provider.id === 'provider-archi-ru-mock') {
      options = { failCreate: 1 };
    }
    bindings.set(
      provider.id,
      new MockPlacementProvider(provider.name, provider.capabilities, options),
    );
  }
  return new InMemoryPlacementProviderRegistry([...providers], bindings, { allowMocks: true });
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`connection timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}