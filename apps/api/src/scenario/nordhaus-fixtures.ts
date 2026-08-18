/**
 * Deterministic Nordhaus scenario fixtures: categories, platforms and
 * providers mirror the Prisma seed (packages/infrastructure/prisma/seed.ts)
 * so the UI demo and `pnpm demo` show the same data without a database.
 */

import type { PlacementCategory, PlacementProvider, Platform } from '@aios/domain';
import type {
  AIProvider,
  CompanyAnalysis,
  CompanyAnalysisInput,
  ContentDraft,
  ContentPreparationInput,
  OpportunityClassification,
  OpportunityClassificationInput,
} from '@aios/ai';
import { MockPlacementProvider, InMemoryPlacementProviderRegistry } from '@aios/integrations';

export const NORDHAUS_CATEGORIES: PlacementCategory[] = [
  {
    id: 'cat-maps-local',
    code: 'maps-local',
    name: 'Maps & local directories',
    description: null,
    sortOrder: 1,
  },
  {
    id: 'cat-furniture-directories',
    code: 'furniture-directories',
    name: 'Furniture directories',
    description: null,
    sortOrder: 2,
  },
  {
    id: 'cat-interior-design',
    code: 'interior-design',
    name: 'Interior & design',
    description: null,
    sortOrder: 3,
  },
  {
    id: 'cat-architecture',
    code: 'architecture',
    name: 'Architecture',
    description: null,
    sortOrder: 4,
  },
  {
    id: 'cat-professional-platforms',
    code: 'professional-platforms',
    name: 'Professional platforms',
    description: null,
    sortOrder: 5,
  },
  {
    id: 'cat-media-pr',
    code: 'media-pr',
    name: 'Media & PR',
    description: null,
    sortOrder: 6,
  },
  {
    id: 'cat-social-platforms',
    code: 'social-platforms',
    name: 'Social platforms',
    description: null,
    sortOrder: 7,
  },
  {
    id: 'cat-b2b-regional',
    code: 'b2b-regional',
    name: 'B2B & regional platforms',
    description: null,
    sortOrder: 8,
  },
];

export const NORDHAUS_PLATFORMS: Platform[] = [
  {
    id: 'platform-yandex-business',
    name: 'Яндекс Бизнес',
    url: 'https://business.yandex.ru',
    country: 'Russia',
    categoryId: 'cat-maps-local',
    notes: 'Demo platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-2gis',
    name: '2ГИС',
    url: 'https://2gis.ru',
    country: 'Russia',
    categoryId: 'cat-maps-local',
    notes: 'Demo platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-mebel-ru',
    name: 'Мебель.ру',
    url: 'https://mebel.ru',
    country: 'Russia',
    categoryId: 'cat-furniture-directories',
    notes: 'Demo platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-inmyroom',
    name: 'INMYROOM',
    url: 'https://inmyroom.ru',
    country: 'Russia',
    categoryId: 'cat-interior-design',
    notes: 'Demo platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-salon-interior',
    name: 'SALON-interior',
    url: 'https://salon.ru',
    country: 'Russia',
    categoryId: 'cat-interior-design',
    notes: 'Demo platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-archi-ru',
    name: 'Archi.ru',
    url: 'https://archi.ru',
    country: 'Russia',
    categoryId: 'cat-architecture',
    notes: 'Demo platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-houzz',
    name: 'Houzz',
    url: 'https://www.houzz.ru',
    country: 'Russia',
    categoryId: 'cat-interior-design',
    notes: 'Demo platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-vk',
    name: 'VK',
    url: 'https://vk.com',
    country: 'Russia',
    categoryId: 'cat-social-platforms',
    notes: 'Demo platform (synthetic seed data)',
    metadata: null,
  },
];

export const NORDHAUS_PROVIDERS: PlacementProvider[] = [
  {
    id: 'provider-yandex-business-mock',
    platformId: 'platform-yandex-business',
    name: 'YandexBusiness Mock',
    providerType: 'MOCK',
    capabilities: ['DISCOVER', 'VALIDATE', 'CREATE', 'GET_STATUS', 'VERIFY'],
    capabilitiesVerified: true,
    notes: 'Mock provider for demo purposes',
  },
  {
    id: 'provider-2gis-mock',
    platformId: 'platform-2gis',
    name: 'TwoGIS Mock',
    providerType: 'MOCK',
    capabilities: ['DISCOVER', 'VALIDATE', 'CREATE', 'GET_STATUS', 'VERIFY'],
    capabilitiesVerified: true,
    notes: 'Mock provider for demo purposes',
  },
  {
    id: 'provider-mebel-ru-mock',
    platformId: 'platform-mebel-ru',
    name: 'MebelRu Mock',
    providerType: 'MOCK',
    capabilities: ['CREATE', 'GET_STATUS', 'VERIFY'],
    capabilitiesVerified: true,
    notes: 'Mock provider for demo purposes (execution without discovery/validation)',
  },
  {
    id: 'provider-archi-ru-mock',
    platformId: 'platform-archi-ru',
    name: 'ArchiRu Mock',
    providerType: 'MOCK',
    capabilities: ['CREATE', 'GET_STATUS', 'VERIFY'],
    capabilitiesVerified: true,
    notes: 'Mock provider for demo purposes',
  },
  {
    id: 'provider-inmyroom-manual',
    platformId: 'platform-inmyroom',
    name: 'INMYROOM Manual',
    providerType: 'MANUAL',
    capabilities: ['VERIFY'],
    capabilitiesVerified: true,
    notes: 'Manual submission workflow; no automated create capability',
  },
  {
    id: 'provider-vk-browser',
    platformId: 'platform-vk',
    name: 'VK Browser',
    providerType: 'BROWSER',
    capabilities: ['CREATE', 'GET_STATUS', 'VERIFY'],
    capabilitiesVerified: false,
    notes: 'Browser automation candidate; capabilities not yet verified',
  },
];

export const NORDHAUS_COMPANY_ANALYSIS_FIXTURE: CompanyAnalysis = {
  businessType: 'Premium made-to-order furniture manufacturer',
  topics: ['made-to-order furniture', 'custom kitchens', 'built-in furniture', 'interior design'],
  audiences: ['premium property owners', 'interior designers', 'architects', 'HoReCa'],
  relevantCategories: ['maps-local', 'furniture-directories', 'interior-design', 'architecture'],
  strategicRecommendations: [
    'Establish profiles on map services and furniture catalogues',
    'Pitch editorial publications focused on interior design',
  ],
};

const CLASSIFICATION_FIXTURES: Readonly<Record<string, OpportunityClassification>> = {
  'https://business.yandex.ru': {
    category: 'maps-local',
    placementType: 'BUSINESS_PROFILE',
    topicalRelevance: 95,
    audienceMatch: 90,
    geographicRelevance: 100,
    recommendationReason: 'Local map profile fits a premium furniture brand',
  },
  'https://2gis.ru': {
    category: 'maps-local',
    placementType: 'BUSINESS_PROFILE',
    topicalRelevance: 93,
    audienceMatch: 88,
    geographicRelevance: 100,
    recommendationReason: 'City map listing matches the Moscow audience',
  },
  'https://mebel.ru': {
    category: 'furniture-directories',
    placementType: 'DIRECTORY_LISTING',
    topicalRelevance: 90,
    audienceMatch: 85,
    geographicRelevance: 90,
    recommendationReason: 'Furniture catalogue matches the brand products',
  },
  'https://inmyroom.ru': {
    category: 'interior-design',
    placementType: 'EDITORIAL_PUBLICATION',
    topicalRelevance: 88,
    audienceMatch: 92,
    geographicRelevance: 80,
    recommendationReason: 'Interior design media with a premium audience',
  },
  'https://salon.ru': {
    category: 'interior-design',
    placementType: 'EDITORIAL_PUBLICATION',
    topicalRelevance: 85,
    audienceMatch: 87,
    geographicRelevance: 75,
    recommendationReason: 'Design publication for premium interiors',
  },
  'https://www.houzz.ru': {
    category: 'interior-design',
    placementType: 'EDITORIAL_PUBLICATION',
    topicalRelevance: 90,
    audienceMatch: 85,
    geographicRelevance: 70,
    recommendationReason: 'Global design platform with a Russian audience',
  },
  'https://archi.ru': {
    category: 'architecture',
    placementType: 'EDITORIAL_PUBLICATION',
    topicalRelevance: 80,
    audienceMatch: 75,
    geographicRelevance: 60,
    recommendationReason: 'Architecture portal reaching architects',
  },
};

/** Fixed AI fixtures: the scenario never calls a real LLM. */
export class ScenarioAIProvider implements AIProvider {
  readonly name = 'scenario-stub';

  analyzeCompany(_input: CompanyAnalysisInput): Promise<CompanyAnalysis> {
    return Promise.resolve(NORDHAUS_COMPANY_ANALYSIS_FIXTURE);
  }

  classifyOpportunity(input: OpportunityClassificationInput): Promise<OpportunityClassification> {
    const fixture = CLASSIFICATION_FIXTURES[input.platform.url ?? ''];
    if (fixture === undefined) {
      return Promise.reject(
        new Error(`ScenarioAIProvider: no classification fixture for ${input.platform.url}`),
      );
    }
    return Promise.resolve(fixture);
  }

  prepareContent(_input: ContentPreparationInput): Promise<ContentDraft> {
    return Promise.resolve({ content: 'Draft content' });
  }
}

export function nordhausProviderCapabilities(
  providerId: string,
): PlacementProvider['capabilities'] {
  const provider = NORDHAUS_PROVIDERS.find((candidate) => candidate.id === providerId);
  if (provider === undefined) {
    throw new Error(`missing scenario provider ${providerId}`);
  }
  return provider.capabilities;
}

/**
 * Registry bound to the MockProvider implementations used by both the demo
 * and the UI server. 2GIS publishes after one poll; Archi.ru fails the first
 * create so the FAILED -> retry path is visible in the UI.
 */
export function createNordhausRegistry(): InMemoryPlacementProviderRegistry {
  return new InMemoryPlacementProviderRegistry(
    NORDHAUS_PROVIDERS,
    new Map([
      [
        'provider-yandex-business-mock',
        new MockPlacementProvider(
          'YandexBusiness Mock',
          nordhausProviderCapabilities('provider-yandex-business-mock'),
        ),
      ],
      [
        'provider-2gis-mock',
        new MockPlacementProvider(
          'TwoGIS Mock',
          nordhausProviderCapabilities('provider-2gis-mock'),
          {
            timeline: ['pending_publication', 'published'],
          },
        ),
      ],
      [
        'provider-mebel-ru-mock',
        new MockPlacementProvider(
          'MebelRu Mock',
          nordhausProviderCapabilities('provider-mebel-ru-mock'),
        ),
      ],
      [
        'provider-archi-ru-mock',
        new MockPlacementProvider(
          'ArchiRu Mock',
          nordhausProviderCapabilities('provider-archi-ru-mock'),
          {
            failCreate: 1,
          },
        ),
      ],
      [
        'provider-inmyroom-manual',
        new MockPlacementProvider(
          'INMYROOM Manual',
          nordhausProviderCapabilities('provider-inmyroom-manual'),
        ),
      ],
    ]),
    { allowMocks: true },
  );
}
