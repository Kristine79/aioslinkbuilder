/**
 * Nordhaus scenario environment: builds the in-memory repository composition
 * (the same repositories used by tests and `pnpm demo`) and runs the
 * application-layer pipeline steps that produce the scenario state. The API
 * server bootstraps a mid-state with this module; every transition runs
 * through the real use cases — nothing is hardcoded into the UI.
 */

import {
  AnalyzeCompanyUseCase,
  ApproveOpportunityUseCase,
  CatalogPlatformDiscoverySource,
  ClassifyOpportunityUseCase,
  DiscoverOpportunitiesUseCase,
  ExecutePlacementUseCase,
  GeneratePlacementStrategyUseCase,
  MonitorPlacementUseCase,
  RequestManualPlacementUseCase,
  VerifyPlacementUseCase,
} from '@aios/application';
import type {
  AIAnalysis,
  Campaign,
  Company,
  Placement,
  PlacementOpportunity,
  PlacementStrategy,
} from '@aios/domain';
import type { VerifyPlacementResult } from '@aios/application';
import {
  InMemoryAIAnalysisRepository,
  InMemoryAuditLogRepository,
  InMemoryCampaignRepository,
  InMemoryCompanyRepository,
  InMemoryEvidenceRepository,
  InMemoryLookupRepository,
  InMemoryPlacementOpportunityRepository,
  InMemoryPlacementRepository,
  InMemoryVerificationRepository,
} from '@aios/infrastructure';

import {
  NORDHAUS_CATEGORIES,
  NORDHAUS_COMPANY_ANALYSIS_FIXTURE,
  NORDHAUS_PLATFORMS,
  NORDHAUS_PROVIDERS,
  ScenarioAIProvider,
  createNordhausRegistry,
} from './nordhaus-fixtures.js';

export interface NordhausEnvironment {
  companies: InMemoryCompanyRepository;
  campaigns: InMemoryCampaignRepository;
  lookups: InMemoryLookupRepository;
  opportunities: InMemoryPlacementOpportunityRepository;
  placements: InMemoryPlacementRepository;
  verifications: InMemoryVerificationRepository;
  evidence: InMemoryEvidenceRepository;
  analyses: InMemoryAIAnalysisRepository;
  auditLog: InMemoryAuditLogRepository;
  registry: ReturnType<typeof createNordhausRegistry>;
  ai: ScenarioAIProvider;
}

export function createNordhausEnvironment(): NordhausEnvironment {
  const env: NordhausEnvironment = {
    companies: new InMemoryCompanyRepository(),
    campaigns: new InMemoryCampaignRepository(),
    lookups: new InMemoryLookupRepository(),
    opportunities: new InMemoryPlacementOpportunityRepository(),
    placements: new InMemoryPlacementRepository(),
    verifications: new InMemoryVerificationRepository(),
    evidence: new InMemoryEvidenceRepository(),
    analyses: new InMemoryAIAnalysisRepository(),
    auditLog: new InMemoryAuditLogRepository(),
    registry: createNordhausRegistry(),
    ai: new ScenarioAIProvider(),
  };
  env.lookups.categories = NORDHAUS_CATEGORIES;
  env.lookups.platforms = NORDHAUS_PLATFORMS;
  env.lookups.providers = NORDHAUS_PROVIDERS;
  return env;
}

export interface NordhausScenarioSeed {
  company: Company;
  campaign: Campaign;
  analysis: AIAnalysis;
  strategy: PlacementStrategy;
  discovered: PlacementOpportunity[];
  classified: PlacementOpportunity[];
}

export const NORDHAUS_PLATFORM_IDS = {
  yandex: 'platform-yandex-business',
  twoGis: 'platform-2gis',
  mebel: 'platform-mebel-ru',
  inmyroom: 'platform-inmyroom',
  salon: 'platform-salon-interior',
  archi: 'platform-archi-ru',
  houzz: 'platform-houzz',
  vk: 'platform-vk',
} as const;

/** Seeds company + campaign and runs analysis, strategy, discovery, classification. */
export async function seedNordhausScenario(
  env: NordhausEnvironment,
): Promise<NordhausScenarioSeed> {
  const company = await env.companies.create({
    name: 'Nordhaus',
    description: 'Производитель премиальной мебели на заказ (синтетическая демо-компания)',
    industry: 'furniture',
    geography: ['Москва', 'Россия'],
    locations: ['Москва'],
    products: ['кухни', 'шкафы-купе', 'встроенная мебель', 'мягкая мебель'],
    targetAudience: [
      'владельцы премиальной недвижимости',
      'дизайнеры интерьеров',
      'архитекторы',
      'HoReCa',
    ],
    website: 'https://nordhaus.example.com',
  });
  const campaign = await env.campaigns.create({
    companyId: company.id,
    name: 'Nordhaus Demo Campaign',
    goals: [
      'Продвижение премиального мебельного бренда в интерьерных и дизайнерских каталогах',
      'Создание профилей на картах и в мебельных каталогах',
    ],
  });

  const analyze = new AnalyzeCompanyUseCase(
    env.campaigns,
    env.companies,
    env.ai,
    env.analyses,
    env.auditLog,
  );
  await analyze.execute({ campaignId: campaign.id });
  const analysis = await env.analyses.findLatestValidCompanyAnalysis(campaign.id);
  if (analysis === null) {
    throw new Error('scenario: company analysis missing after AnalyzeCompany');
  }

  const strategy = new GeneratePlacementStrategyUseCase(
    env.campaigns,
    env.companies,
    env.analyses,
    env.lookups,
  );
  const strategyResult = await strategy.execute({ campaignId: campaign.id });

  const discover = new DiscoverOpportunitiesUseCase(
    env.campaigns,
    env.companies,
    env.lookups,
    env.opportunities,
    env.auditLog,
    [new CatalogPlatformDiscoverySource(env.lookups)],
  );
  const discovered = await discover.execute({
    campaignId: campaign.id,
    placementType: 'BUSINESS_PROFILE',
    categoryCodes: NORDHAUS_COMPANY_ANALYSIS_FIXTURE.relevantCategories,
  });

  const classify = new ClassifyOpportunityUseCase(
    env.ai,
    env.opportunities,
    env.analyses,
    env.lookups,
    env.registry,
    env.auditLog,
  );
  const classified: PlacementOpportunity[] = [];
  for (const opportunity of discovered) {
    classified.push(await classify.execute({ opportunityId: opportunity.id }));
  }

  return { company, campaign, analysis, strategy: strategyResult, discovered, classified };
}

export async function approveScenarioOpportunity(
  env: NordhausEnvironment,
  platformId: string,
): Promise<PlacementOpportunity> {
  const opportunity = await findOpportunityByPlatform(env, platformId);
  const approve = new ApproveOpportunityUseCase(env.opportunities, env.auditLog);
  return approve.execute({ opportunityId: opportunity.id });
}

export async function executeScenarioPlacement(
  env: NordhausEnvironment,
  platformId: string,
): Promise<Placement> {
  const opportunity = await findOpportunityByPlatform(env, platformId);
  const execute = new ExecutePlacementUseCase(
    env.opportunities,
    env.placements,
    env.campaigns,
    env.companies,
    env.registry,
    env.auditLog,
  );
  return execute.execute({ opportunityId: opportunity.id });
}

export async function monitorScenarioPlacement(
  env: NordhausEnvironment,
  placementId: string,
): Promise<Placement> {
  const monitor = new MonitorPlacementUseCase(env.placements, env.registry, env.auditLog);
  return monitor.execute({ placementId });
}

export async function verifyScenarioPlacement(
  env: NordhausEnvironment,
  placementId: string,
): Promise<VerifyPlacementResult> {
  const verify = new VerifyPlacementUseCase(
    env.placements,
    env.opportunities,
    env.campaigns,
    env.companies,
    env.registry,
    env.verifications,
    env.evidence,
    env.auditLog,
  );
  return verify.execute({ placementId });
}

export async function requestManualScenarioPlacement(
  env: NordhausEnvironment,
  platformId: string,
  reason: string,
): Promise<Placement> {
  const opportunity = await findOpportunityByPlatform(env, platformId);
  const requestManual = new RequestManualPlacementUseCase(
    env.opportunities,
    env.placements,
    env.registry,
    env.auditLog,
  );
  return requestManual.execute({ opportunityId: opportunity.id, reason });
}

/** Resolves the single demo campaign (the scenario seeds exactly one). */
export function findScenarioCampaign(env: NordhausEnvironment): Campaign {
  const campaign = [...env.campaigns.campaigns.values()][0];
  if (campaign === undefined) {
    throw new Error('scenario: campaign not seeded');
  }
  return campaign;
}

async function findOpportunityByPlatform(
  env: NordhausEnvironment,
  platformId: string,
): Promise<PlacementOpportunity> {
  const campaign = findScenarioCampaign(env);
  const opportunity = await env.opportunities.findByCampaignIdAndPlatformId(
    campaign.id,
    platformId,
  );
  if (opportunity === null) {
    throw new Error(`scenario: no opportunity for platform ${platformId}`);
  }
  return opportunity;
}
