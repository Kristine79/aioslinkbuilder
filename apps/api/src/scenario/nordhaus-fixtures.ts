/**
 * Deterministic scenario fixtures: categories, platforms and providers
 * mirror the Prisma seed (packages/infrastructure/prisma/seed.ts) so the UI
 * demo and `pnpm demo` show the same data without a database.
 *
 * The catalog contains 20 platforms: the core catalog platforms and the
 * platforms "found by search" (a deterministic search source — see
 * SearchPlatformDiscoverySource). The ScenarioAIProvider returns fixtures
 * for the Nordhaus company and deterministic fallbacks for any other company,
 * so the product works for arbitrary input, not only the demo scenario.
 */

import { DEFAULT_PLACEMENT_TYPE_BY_CATEGORY, recommendAnchorType } from '@aios/domain';
import type {
  DonorQualityProfile,
  PlacementCategory,
  PlacementProvider,
  Platform,
} from '@aios/domain';
import type {
  AIAnchorRecommendation,
  AIDonorRisk,
  AILinkInsert,
  AINegotiationAnalysis,
  AIPageAnalysis,
  AIOutreachMessage,
  AIProvider,
  AnchorRecommendationInput,
  CompanyAnalysis,
  CompanyAnalysisInput,
  ContentDraft,
  ContentPreparationInput,
  DonorQualityEstimateInput,
  DonorQualityEstimates,
  DonorRiskInput,
  LinkInsertInput,
  NegotiationReplyInput,
  OpportunityClassification,
  OpportunityClassificationInput,
  OutreachInput,
  PageAnalysisInput,
} from '@aios/ai';
import { MockPlacementProvider, InMemoryPlacementProviderRegistry } from '@aios/integrations';
import { DONOR_FIXTURES, PAGE_FIXTURES } from './nordhaus-intel.js';

export const NORDHAUS_CATEGORIES: PlacementCategory[] = [
  {
    id: 'cat-maps-local',
    code: 'maps-local',
    name: 'Карты и локальные каталоги',
    description: null,
    sortOrder: 1,
  },
  {
    id: 'cat-furniture-directories',
    code: 'furniture-directories',
    name: 'Мебельные каталоги',
    description: null,
    sortOrder: 2,
  },
  {
    id: 'cat-interior-design',
    code: 'interior-design',
    name: 'Интерьер и дизайн',
    description: null,
    sortOrder: 3,
  },
  {
    id: 'cat-architecture',
    code: 'architecture',
    name: 'Архитектура',
    description: null,
    sortOrder: 4,
  },
  {
    id: 'cat-professional-platforms',
    code: 'professional-platforms',
    name: 'Профессиональные площадки',
    description: null,
    sortOrder: 5,
  },
  {
    id: 'cat-media-pr',
    code: 'media-pr',
    name: 'Медиа и PR',
    description: null,
    sortOrder: 6,
  },
  {
    id: 'cat-social-platforms',
    code: 'social-platforms',
    name: 'Социальные платформы',
    description: null,
    sortOrder: 7,
  },
  {
    id: 'cat-b2b-regional',
    code: 'b2b-regional',
    name: 'B2B и региональные площадки',
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
  {
    id: 'platform-zoon',
    name: 'Zoon.ru',
    url: 'https://zoon.ru',
    country: 'Russia',
    categoryId: 'cat-maps-local',
    notes: 'Search-discovered platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-flamp',
    name: 'Flamp',
    url: 'https://flamp.ru',
    country: 'Russia',
    categoryId: 'cat-maps-local',
    notes: 'Search-discovered platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-divan-ru',
    name: 'Divan.ru',
    url: 'https://divan.ru',
    country: 'Russia',
    categoryId: 'cat-furniture-directories',
    notes: 'Search-discovered platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-mebelion',
    name: 'Mebelion',
    url: 'https://mebelion.ru',
    country: 'Russia',
    categoryId: 'cat-furniture-directories',
    notes: 'Search-discovered platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-mebel-ot-fabrik',
    name: 'Мебель от фабрик',
    url: 'https://mebel-ot-fabrik.ru',
    country: 'Russia',
    categoryId: 'cat-furniture-directories',
    notes: 'Search-discovered platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-designmate',
    name: 'Design Mate',
    url: 'https://designmate.ru',
    country: 'Russia',
    categoryId: 'cat-interior-design',
    notes: 'Search-discovered platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-roomble',
    name: 'Roomble',
    url: 'https://roomble.com',
    country: 'Russia',
    categoryId: 'cat-interior-design',
    notes: 'Search-discovered platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-mydecor',
    name: 'MyDecor',
    url: 'https://mydecor.ru',
    country: 'Russia',
    categoryId: 'cat-interior-design',
    notes: 'Search-discovered platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-archspeech',
    name: 'Archspeech',
    url: 'https://archspeech.com',
    country: 'Russia',
    categoryId: 'cat-architecture',
    notes: 'Search-discovered platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-profi-ru',
    name: 'Профи.ру',
    url: 'https://profi.ru',
    country: 'Russia',
    categoryId: 'cat-professional-platforms',
    notes: 'Search-discovered platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-vc-ru',
    name: 'VC.ru',
    url: 'https://vc.ru',
    country: 'Russia',
    categoryId: 'cat-media-pr',
    notes: 'Search-discovered platform (synthetic seed data)',
    metadata: null,
  },
  {
    id: 'platform-dzen',
    name: 'Дзен',
    url: 'https://dzen.ru',
    country: 'Russia',
    categoryId: 'cat-media-pr',
    notes: 'Search-discovered platform (synthetic seed data)',
    metadata: null,
  },
];

/** Platforms discovered by the deterministic search source (see SearchPlatformDiscoverySource). */
export const NORDHAUS_SEARCH_PLATFORM_IDS: readonly string[] = [
  'platform-zoon',
  'platform-flamp',
  'platform-divan-ru',
  'platform-mebelion',
  'platform-mebel-ot-fabrik',
  'platform-designmate',
  'platform-roomble',
  'platform-mydecor',
  'platform-archspeech',
  'platform-profi-ru',
  'platform-vc-ru',
  'platform-dzen',
];

/** Core catalog platforms owned by the catalog discovery source. */
export const NORDHAUS_CORE_PLATFORM_IDS: readonly string[] = [
  'platform-yandex-business',
  'platform-2gis',
  'platform-mebel-ru',
  'platform-inmyroom',
  'platform-salon-interior',
  'platform-archi-ru',
  'platform-houzz',
  'platform-vk',
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
  {
    id: 'provider-zoon-mock',
    platformId: 'platform-zoon',
    name: 'ZoonRu Mock',
    providerType: 'MOCK',
    capabilities: ['CREATE', 'GET_STATUS', 'VERIFY'],
    capabilitiesVerified: true,
    notes: 'Mock provider for demo purposes',
  },
  {
    id: 'provider-flamp-mock',
    platformId: 'platform-flamp',
    name: 'Flamp Mock',
    providerType: 'MOCK',
    capabilities: ['CREATE', 'GET_STATUS', 'VERIFY'],
    capabilitiesVerified: true,
    notes: 'Mock provider for demo purposes',
  },
  {
    id: 'provider-divan-ru-mock',
    platformId: 'platform-divan-ru',
    name: 'DivanRu Mock',
    providerType: 'MOCK',
    capabilities: ['CREATE', 'GET_STATUS', 'VERIFY'],
    capabilitiesVerified: true,
    notes: 'Mock provider for demo purposes',
  },
  {
    id: 'provider-designmate-mock',
    platformId: 'platform-designmate',
    name: 'DesignMate Mock',
    providerType: 'MOCK',
    capabilities: ['CREATE', 'GET_STATUS', 'VERIFY'],
    capabilitiesVerified: true,
    notes: 'Mock provider for demo purposes',
  },
  {
    id: 'provider-roomble-mock',
    platformId: 'platform-roomble',
    name: 'Roomble Mock',
    providerType: 'MOCK',
    capabilities: ['CREATE', 'GET_STATUS', 'VERIFY'],
    capabilitiesVerified: true,
    notes: 'Mock provider for demo purposes',
  },
  {
    id: 'provider-archspeech-mock',
    platformId: 'platform-archspeech',
    name: 'Archspeech Mock',
    providerType: 'MOCK',
    capabilities: ['CREATE', 'GET_STATUS', 'VERIFY'],
    capabilitiesVerified: true,
    notes: 'Mock provider for demo purposes',
  },
  {
    id: 'provider-profi-ru-mock',
    platformId: 'platform-profi-ru',
    name: 'ProfiRu Mock',
    providerType: 'MOCK',
    capabilities: ['CREATE', 'GET_STATUS', 'VERIFY'],
    capabilitiesVerified: true,
    notes: 'Mock provider for demo purposes',
  },
];

export const NORDHAUS_COMPANY_ANALYSIS_FIXTURE: CompanyAnalysis = {
  businessType: 'Производитель премиальной мебели на заказ',
  topics: ['мебель на заказ', 'кухни на заказ', 'встроенная мебель', 'дизайн интерьеров'],
  audiences: [
    'владельцы премиальной недвижимости',
    'дизайнеры интерьеров',
    'архитекторы',
    'HoReCa',
  ],
  relevantCategories: ['maps-local', 'furniture-directories', 'interior-design', 'architecture'],
  strategicRecommendations: [
    'Создать профили на картах и в мебельных каталогах',
    'Публикации в интерьерных изданиях',
  ],
};

const CLASSIFICATION_FIXTURES: Readonly<Record<string, OpportunityClassification>> = {
  'https://business.yandex.ru': {
    category: 'maps-local',
    placementType: 'BUSINESS_PROFILE',
    topicalRelevance: 95,
    audienceMatch: 90,
    geographicRelevance: 100,
    recommendationReason: 'Профиль на картах подходит премиальному мебельному бренду',
  },
  'https://2gis.ru': {
    category: 'maps-local',
    placementType: 'BUSINESS_PROFILE',
    topicalRelevance: 93,
    audienceMatch: 88,
    geographicRelevance: 100,
    recommendationReason: 'Карточка на городской карте соответствует аудитории Москвы',
  },
  'https://mebel.ru': {
    category: 'furniture-directories',
    placementType: 'DIRECTORY_LISTING',
    topicalRelevance: 90,
    audienceMatch: 85,
    geographicRelevance: 90,
    recommendationReason: 'Мебельный каталог совпадает с продукцией бренда',
  },
  'https://inmyroom.ru': {
    category: 'interior-design',
    placementType: 'EDITORIAL_PUBLICATION',
    topicalRelevance: 88,
    audienceMatch: 92,
    geographicRelevance: 80,
    recommendationReason: 'Медиа об интерьерном дизайне с премиальной аудиторией',
  },
  'https://salon.ru': {
    category: 'interior-design',
    placementType: 'EDITORIAL_PUBLICATION',
    topicalRelevance: 85,
    audienceMatch: 87,
    geographicRelevance: 75,
    recommendationReason: 'Дизайн-издание о премиальных интерьерах',
  },
  'https://www.houzz.ru': {
    category: 'interior-design',
    placementType: 'LINK_INSERT',
    topicalRelevance: 90,
    audienceMatch: 85,
    geographicRelevance: 70,
    recommendationReason:
      'Глобальная дизайн-платформа с российской аудиторией — подходящая страница для вставки ссылки на мебель на заказ',
  },
  'https://archi.ru': {
    category: 'architecture',
    placementType: 'EDITORIAL_PUBLICATION',
    topicalRelevance: 80,
    audienceMatch: 75,
    geographicRelevance: 60,
    recommendationReason: 'Архитектурный портал для аудитории архитекторов',
  },
  'https://zoon.ru': {
    category: 'maps-local',
    placementType: 'BUSINESS_PROFILE',
    topicalRelevance: 87,
    audienceMatch: 84,
    geographicRelevance: 96,
    recommendationReason: 'Отзовиковый сервис с геолокацией, подходит локальному бизнесу',
  },
  'https://flamp.ru': {
    category: 'maps-local',
    placementType: 'BUSINESS_PROFILE',
    topicalRelevance: 85,
    audienceMatch: 83,
    geographicRelevance: 95,
    recommendationReason: 'Городская платформа отзывов и рекомендаций',
  },
  'https://divan.ru': {
    category: 'furniture-directories',
    placementType: 'DIRECTORY_LISTING',
    topicalRelevance: 91,
    audienceMatch: 84,
    geographicRelevance: 88,
    recommendationReason: 'Мебельный маркетплейс с аудиторией покупателей мебели',
  },
  'https://designmate.ru': {
    category: 'interior-design',
    placementType: 'EDITORIAL_PUBLICATION',
    topicalRelevance: 89,
    audienceMatch: 91,
    geographicRelevance: 82,
    recommendationReason: 'Платформа о дизайне интерьеров с премиальной аудиторией',
  },
  'https://roomble.com': {
    category: 'interior-design',
    placementType: 'EDITORIAL_PUBLICATION',
    topicalRelevance: 86,
    audienceMatch: 88,
    geographicRelevance: 76,
    recommendationReason: 'Журнал об интерьере, ремонте и дизайне',
  },
  'https://archspeech.com': {
    category: 'architecture',
    placementType: 'EDITORIAL_PUBLICATION',
    topicalRelevance: 81,
    audienceMatch: 76,
    geographicRelevance: 65,
    recommendationReason: 'Издание об архитектуре и городской среде',
  },
  'https://profi.ru': {
    category: 'professional-platforms',
    placementType: 'BUSINESS_PROFILE',
    topicalRelevance: 77,
    audienceMatch: 80,
    geographicRelevance: 80,
    recommendationReason: 'Площадка специалистов, профиль компании среди поставщиков услуг',
  },
};

const CATEGORY_NAME_BY_CODE: Readonly<Record<string, string>> = Object.fromEntries(
  NORDHAUS_CATEGORIES.map((category) => [category.code, category.name]),
);

/** Deterministic fallback scores per category for search-discovered platforms. */
const CATEGORY_BASE_SEMANTIC_SCORES: Readonly<
  Record<string, { topicalRelevance: number; audienceMatch: number; geographicRelevance: number }>
> = {
  'maps-local': { topicalRelevance: 86, audienceMatch: 82, geographicRelevance: 95 },
  'furniture-directories': { topicalRelevance: 88, audienceMatch: 82, geographicRelevance: 86 },
  'interior-design': { topicalRelevance: 84, audienceMatch: 87, geographicRelevance: 74 },
  architecture: { topicalRelevance: 78, audienceMatch: 74, geographicRelevance: 66 },
  'professional-platforms': { topicalRelevance: 76, audienceMatch: 78, geographicRelevance: 78 },
  'media-pr': { topicalRelevance: 78, audienceMatch: 80, geographicRelevance: 72 },
  'social-platforms': { topicalRelevance: 74, audienceMatch: 84, geographicRelevance: 78 },
  'b2b-regional': { topicalRelevance: 74, audienceMatch: 72, geographicRelevance: 80 },
};

/** Industry -> relevant placement categories, used by the deterministic analysis fallback. */
const INDUSTRY_CATEGORIES: Readonly<Record<string, readonly string[]>> = {
  furniture: ['maps-local', 'furniture-directories', 'interior-design', 'architecture'],
  'real-estate': ['maps-local', 'professional-platforms', 'media-pr', 'b2b-regional'],
  it: ['professional-platforms', 'media-pr', 'social-platforms'],
  software: ['professional-platforms', 'media-pr', 'social-platforms'],
  design: ['professional-platforms', 'interior-design', 'media-pr', 'social-platforms'],
  services: ['maps-local', 'professional-platforms', 'media-pr'],
  retail: ['maps-local', 'media-pr', 'social-platforms', 'b2b-regional'],
  ecommerce: ['maps-local', 'media-pr', 'social-platforms', 'b2b-regional'],
  health: ['maps-local', 'professional-platforms', 'media-pr'],
  education: ['professional-platforms', 'media-pr', 'social-platforms'],
};

const DEFAULT_RELEVANT_CATEGORIES = [
  'maps-local',
  'professional-platforms',
  'media-pr',
  'social-platforms',
];

/** Fixed AI fixtures for the demo scenario: the scenario never calls a real LLM. */
export class ScenarioAIProvider implements AIProvider {
  readonly name = 'demo-ai';

  analyzeCompany(input: CompanyAnalysisInput): Promise<CompanyAnalysis> {
    if (input.companyName.toLowerCase().includes('nordhaus')) {
      return Promise.resolve(NORDHAUS_COMPANY_ANALYSIS_FIXTURE);
    }
    return Promise.resolve(deterministicCompanyAnalysis(input));
  }

  classifyOpportunity(input: OpportunityClassificationInput): Promise<OpportunityClassification> {
    const fixture = CLASSIFICATION_FIXTURES[input.platform.url ?? ''];
    if (fixture !== undefined) {
      return Promise.resolve(fixture);
    }
    return Promise.resolve(deterministicClassification(input));
  }

  prepareContent(input: ContentPreparationInput): Promise<ContentDraft> {
    return Promise.resolve({
      content: `Компания ${input.company.name}: ${input.company.description ?? ''}`.trim(),
    });
  }

  analyzePage(input: PageAnalysisInput): Promise<AIPageAnalysis> {
    const fixture = input.platform.url === null ? undefined : PAGE_FIXTURES[input.platform.url];
    if (fixture !== undefined) {
      return Promise.resolve({
        targetPage: fixture.targetPage ?? '',
        pageTitle: fixture.pageTitle ?? '',
        pageType: fixture.pageType,
        topicalRelevance: fixture.topicalRelevance.value ?? 80,
        linkInsertSuitability: fixture.linkInsertSuitability.value ?? 75,
        indexation: fixture.indexation.value ?? 'INDEXED',
        suggestedPlacementLocation: fixture.suggestedPlacementLocation ?? '',
        summary: fixture.summary ?? '',
      });
    }
    return Promise.resolve(deterministicPageAnalysis(input));
  }

  generateLinkInsert(input: LinkInsertInput): Promise<AILinkInsert> {
    const company = input.company.name;
    const product = input.company.products[0] ?? 'мебель на заказ';
    const anchor = input.desiredAnchor ?? `${product.toLowerCase()} от ${company}`;
    const pageHint = input.targetPage !== null ? ` на странице ${input.targetPage}` : '';
    return Promise.resolve({
      anchor,
      anchorAlternatives: [`${company} — ${product}`, `${company}`, `${product} по индивидуальным проектам`],
      suggestedInsertionPoint: 'Второй абзац, после вводного описания темы статьи',
      text: `Для тех, кто ищет качественную ${product.toLowerCase()}, ${company} изготавливает кухни и встроенную мебель по индивидуальным проектам${pageHint ? ` (${input.targetPage})` : ''} — подробнее на сайте компании.`,
      explanation:
        'Вставка естественно продолжает мысль статьи о выборе мебели: компания-производитель упоминается в контексте конкретного запроса читателя, а не как отдельный рекламный блок.',
      confidence: 82,
    });
  }

  recommendAnchor(input: AnchorRecommendationInput): Promise<AIAnchorRecommendation> {
    const decision = recommendAnchorType({
      placementObjective: input.placementObjective,
      companyName: input.companyName,
      targetKeyword: input.targetKeyword,
      surroundingContext: input.surroundingContext,
      targetPageRelevance: input.targetPageRelevance ?? null,
      anchorProfileAvailable: input.anchorProfileAvailable,
    });
    const keyword = input.targetKeyword ?? 'мебель на заказ';
    const anchor =
      decision.anchorType === 'BRANDED'
        ? input.companyName
        : decision.anchorType === 'LONG_TAIL'
          ? `${keyword.toLowerCase()} по индивидуальным проектам`
          : `${keyword.toLowerCase()} от ${input.companyName}`;
    return Promise.resolve({
      anchorType: decision.anchorType,
      anchor,
      alternatives:
        decision.anchorType === 'BRANDED'
          ? [input.companyName, `${keyword.toLowerCase()} от ${input.companyName}`]
          : [input.companyName, `${keyword.toLowerCase()} от ${input.companyName}`, 'производитель мебели на заказ'],
      explanation: decision.explanation,
      confidence: 76,
    });
  }

  generateOutreach(input: OutreachInput): Promise<AIOutreachMessage> {
    const company = input.company.name;
    const platformName = input.platform.name;
    const product = input.company.products[0] ?? 'мебель на заказ';
    const anchor = input.anchor ?? `${product.toLowerCase()} от ${company}`;
    const pageRef = input.pageTitle !== null ? ` в статье «${input.pageTitle}»` : '';
    return Promise.resolve({
      subject: `${company}: предложение для ${platformName}`,
      opening: `Здравствуйте! Редакции ${platformName} — команда ${company}, производителя мебели на заказ.`,
      valueProposition: `Мы производим ${product.toLowerCase()} по индивидуальным проектам и можем предложить читателям ${platformName} полезный материал о выборе и заказе мебели.`,
      message: `Здравствуйте! Редакции ${platformName} пишет команда ${company}, производителя мебели на заказ (${input.company.website ?? ''}). Мы производим ${product.toLowerCase()} по индивидуальным проектам и готовы поделиться с вашей аудиторией экспертным материалом о выборе и заказе мебели. Просим рассмотреть добавление ссылки${pageRef !== '' ? pageRef : ' на наш сайт'} с анкором «${anchor}». Будем рады обсудить детали.`,
      shortVersion: `Здравствуйте! ${company} предлагает добавить ссылку с анкором «${anchor}» в статью о выборе мебели. Обсудим детали?`,
      placementRequest: `добавление ссылки${pageRef !== '' ? pageRef : ' на наш сайт'} с анкором «${anchor}»`,
      cta: 'Будем рады обсудить детали и предоставить дополнительные материалы.',
    });
  }

  analyzeNegotiationReply(input: NegotiationReplyInput): Promise<AINegotiationAnalysis> {
    return Promise.resolve(classifyNegotiationReply(input));
  }

  estimateDonorQuality(input: DonorQualityEstimateInput): Promise<DonorQualityEstimates> {
    const fixture = input.platform.url === null ? undefined : CLASSIFICATION_FIXTURES[input.platform.url];
    const base =
      fixture === undefined
        ? CATEGORY_BASE_SEMANTIC_SCORES[categoryCodeFor(input.platform.category)] ?? {
            topicalRelevance: 80,
            audienceMatch: 80,
            geographicRelevance: 80,
          }
        : {
            topicalRelevance: fixture.topicalRelevance,
            audienceMatch: fixture.audienceMatch,
            geographicRelevance: fixture.geographicRelevance,
          };
    return Promise.resolve({
      topicalRelevance: clamp(base.topicalRelevance + deterministicDelta(input.platform.name, input.platform.url)),
      audienceMatch: clamp(base.audienceMatch + deterministicDelta(input.platform.name, input.platform.url)),
      geographicRelevance: clamp(base.geographicRelevance + deterministicDelta(input.platform.name, input.platform.url)),
      placementQuality: clamp(base.topicalRelevance - 5 + deterministicDelta(input.platform.name, input.platform.url)),
      automationPotential: DEFAULT_PLACEMENT_TYPE_BY_CATEGORY[categoryCodeFor(input.platform.category)] === 'BUSINESS_PROFILE' ? 90 : 55,
      overallAssessment: `Площадка ${input.platform.name} оценена по синтетическим демо-данным`,
    });
  }

  assessDonorRisk(input: DonorRiskInput): Promise<AIDonorRisk> {
    const profile = input.donorQuality as DonorQualityProfile | null;
    const reasons: string[] = [];
    let level: AIDonorRisk['level'] = 'UNKNOWN';
    if (profile !== null && typeof profile === 'object') {
      const donorUrl = input.platform.url;
      const fixture = donorUrl === null ? undefined : DONOR_FIXTURES[donorUrl];
      if (fixture !== undefined) {
        if (fixture.spamRisk >= 60) {
          level = 'HIGH';
          reasons.push('высокий spam-риск — признаки продажи ссылок');
        } else if (fixture.spamRisk >= 35 || fixture.indexing === 'PARTIAL') {
          level = 'MEDIUM';
          if (fixture.spamRisk >= 35) reasons.push('повышенный spam-риск');
          if (fixture.indexing === 'PARTIAL') reasons.push('неполная индексация страниц');
        } else {
          level = 'LOW';
          reasons.push('профиль донора чистый');
        }
      }
    }
    return Promise.resolve({ level, reasons });
  }
}

/** Deterministic company analysis for arbitrary companies (no real LLM in demo mode). */
function deterministicCompanyAnalysis(input: CompanyAnalysisInput): CompanyAnalysis {
  const industryKey = normalizeIndustry(input.industry, input.description);
  const relevantCategories = [...(INDUSTRY_CATEGORIES[industryKey] ?? DEFAULT_RELEVANT_CATEGORIES)];

  const topics = unique([...input.products.map(trimmedLower), ...derivedTopics(industryKey)]).slice(
    0,
    5,
  );
  const audiences = unique(input.targetAudience.map(trimmedLower)).slice(0, 5);
  const geographyLine =
    input.geography.length > 0 ? input.geography.slice(0, 3).join(', ') : 'Россия';

  return {
    businessType: businessTypeFor(industryKey, input.description, input.companyName),
    topics: topics.length > 0 ? topics : ['продвижение бренда'],
    audiences: audiences.length > 0 ? audiences : ['клиенты компании', 'отраслевые специалисты'],
    relevantCategories,
    strategicRecommendations: [
      `Создать профили компании на площадках категорий: ${relevantCategories
        .slice(0, 3)
        .map((code) => CATEGORY_NAME_BY_CODE[code] ?? code)
        .join(', ')}`,
      `Разместить материалы о компании на площадках с аудиторией из региона: ${geographyLine}`,
    ],
  };
}

function normalizeIndustry(industry: string | null, description: string | null): string {
  const haystack = `${industry ?? ''} ${description ?? ''}`.toLowerCase();
  const known = Object.keys(INDUSTRY_CATEGORIES);
  const match = known.find((key) => haystack.includes(key));
  return match ?? 'services';
}

function derivedTopics(industryKey: string): string[] {
  const map: Readonly<Record<string, string[]>> = {
    furniture: ['мебель', 'интерьер', 'производство мебели'],
    'real-estate': ['недвижимость', 'продажа и аренда', 'коммерческая недвижимость'],
    it: ['информационные технологии', 'разработка ПО', 'цифровые услуги'],
    software: ['информационные технологии', 'разработка ПО', 'цифровые услуги'],
    design: ['дизайн', 'интерьер', 'брендинг'],
    services: ['услуги', 'обслуживание клиентов', 'экспертиза'],
    retail: ['розничная торговля', 'товары', 'магазины'],
    ecommerce: ['интернет-магазин', 'доставка', 'товары'],
    health: ['здоровье', 'медицинские услуги', 'клиника'],
    education: ['образование', 'обучение', 'курсы'],
  };
  return map[industryKey] ?? ['продукты и услуги', 'развитие бизнеса'];
}

function businessTypeFor(industryKey: string, description: string | null, name: string): string {
  const typeByIndustry: Readonly<Record<string, string>> = {
    furniture: 'Производитель и продавец мебели',
    'real-estate': 'Компания в сфере недвижимости',
    it: 'Компания в сфере информационных технологий',
    software: 'Компания в сфере информационных технологий',
    design: 'Дизайн-студия',
    services: 'Компания в сфере услуг',
    retail: 'Розничная компания',
    ecommerce: 'Интернет-магазин',
    health: 'Компания в сфере здоровья',
    education: 'Образовательная компания',
  };
  if (description !== null && description.trim().length > 0) {
    const firstSentence = description.trim().split(/[.!?\n]/)[0] ?? description.trim();
    if (firstSentence.length > 0) {
      return firstSentence;
    }
  }
  return `${typeByIndustry[industryKey] ?? 'Компания'} «${name}»`;
}

/** Deterministic classification for platforms without a curated fixture. */
function deterministicClassification(
  input: OpportunityClassificationInput,
): OpportunityClassification {
  const categoryCode = categoryCodeFor(input.platform.category);
  const base = CATEGORY_BASE_SEMANTIC_SCORES[categoryCode] ?? {
    topicalRelevance: 80,
    audienceMatch: 80,
    geographicRelevance: 80,
  };
  const delta = deterministicDelta(input.platform.name, input.platform.url);
  return {
    category: CATEGORY_NAME_BY_CODE[categoryCode] ?? input.platform.category ?? categoryCode,
    placementType: DEFAULT_PLACEMENT_TYPE_BY_CATEGORY[categoryCode] ?? 'DIRECTORY_LISTING',
    topicalRelevance: clamp(base.topicalRelevance + delta),
    audienceMatch: clamp(base.audienceMatch + delta),
    geographicRelevance: clamp(base.geographicRelevance + delta),
    recommendationReason: `Площадка из категории «${
      CATEGORY_NAME_BY_CODE[categoryCode] ?? categoryCode
    }» тематически близка бизнесу компании и её аудитории`,
  };
}

function categoryCodeFor(categoryName: string | null): string {
  if (categoryName === null) return 'services';
  const byName = NORDHAUS_CATEGORIES.find((category) => category.name === categoryName);
  return byName?.code ?? 'services';
}

/** Deterministic small variance (-4..+4) so platforms of one category differ. */
function deterministicDelta(name: string, url: string | null): number {
  let hash = 0;
  for (const char of `${name}:${url ?? ''}`) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return (Math.abs(hash) % 9) - 4;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function trimmedLower(value: string): string {
  return value.trim().toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** Deterministic page analysis for platforms without a curated fixture. */
function deterministicPageAnalysis(input: PageAnalysisInput): AIPageAnalysis {
  const categoryCode = categoryCodeFor(input.platform.category);
  const base = CATEGORY_BASE_SEMANTIC_SCORES[categoryCode] ?? {
    topicalRelevance: 80,
    audienceMatch: 80,
    geographicRelevance: 80,
  };
  return {
    targetPage: input.platform.url ?? input.platform.name,
    pageTitle: input.platform.name,
    pageType: 'PROFILE',
    topicalRelevance: clamp(base.topicalRelevance + deterministicDelta(input.platform.name, input.platform.url)),
    linkInsertSuitability: clamp(base.topicalRelevance - 8 + deterministicDelta(input.platform.name, input.platform.url)),
    indexation: 'INDEXED',
    suggestedPlacementLocation: 'Страница профиля компании',
    summary: `Площадка «${input.platform.name}» — профиль компании в категории «${
      CATEGORY_NAME_BY_CODE[categoryCode] ?? categoryCode
    }».`,
  };
}

/** Deterministic donor-reply classification used by the demo AI provider. */
function classifyNegotiationReply(input: NegotiationReplyInput): AINegotiationAnalysis {
  const text = input.donorReply.toLowerCase();
  const company = input.company.name;
  const platformName = input.platformName;
  const priceMatch = text.match(/\d[\d\s]*(?:[.,]\d+)?\s*(?:usd|\$|руб|₽)?/);
  const hasAmount = /\$\s*\d+|\d+\s*(?:usd|руб|₽)|\b(?:за|стоит|цена|оплата|платно)\b/.test(text);

  const base = {
    suggestedResponse: '',
    strategy: '',
    recommendedPrice: null as { min: number; max: number; currency: string } | null,
    fallbackOption: null as string | null,
    risks: [] as string[],
    confidence: 78,
  };

  if (/(nofollow|rel="nofollow"|атрибут)/.test(text)) {
    return {
      ...base,
      intent: 'LINK_ATTRIBUTE_REQUEST',
      suggestedResponse: `Готовы обсудить атрибуты ссылки. Для ${company} важно, чтобы ссылка не была nofollow. Можем ли договориться о dofollow-ссылке?`,
      strategy: 'Обсудить атрибуты ссылки; предложить доплату за dofollow, если площадка настаивает.',
      risks: ['Если ссылка будет nofollow, ценность размещения снижается.'],
      fallbackOption: 'Предложить брендированное упоминание без ссылки.',
    };
  }

  if (/(согласн|публикуем|можно|готовы|ок\b|да\b|подходит)/.test(text)) {
    return {
      ...base,
      intent: 'ACCEPTED',
      suggestedResponse: `Отлично! Спасибо, что готовы разместить ссылку. Уточните, пожалуйста, сроки публикации и итоговый адрес статьи.`,
      strategy: 'Подтвердить договорённость и запросить детали публикации.',
      risks: [],
      confidence: 85,
    };
  }

  if (/(не можем|отказ|не подходит|не заинтересован|нет\b)/.test(text)) {
    return {
      ...base,
      intent: 'REJECTED',
      suggestedResponse: `Спасибо за ответ. Если ситуация изменится, будем рады вернуться к обсуждению.`,
      strategy: 'Вежливо закрыть тему и переключиться на запасной вариант.',
      risks: [],
      fallbackOption: 'Рассмотреть другую площадку из списка возможностей.',
    };
  }

  if (/(стать|контент|материал|текст|гостев)/.test(text)) {
    return {
      ...base,
      intent: 'CONTENT_REQUIREMENTS',
      suggestedResponse: `Мы готовы подготовить материал для ${platformName}. Уточните, пожалуйста, требования к объёму, теме и срокам — подготовим статью в ближайшее время.`,
      strategy: 'Уточнить требования к контенту и предложить готовый черновик.',
      risks: ['Материал может не пройти редактуру площадки.'],
      fallbackOption: 'Предложить более короткий формат — вставку ссылки в существующую статью.',
    };
  }

  if (hasAmount) {
    const rawAmount = priceMatch?.[0]?.match(/\d[\d\s]*/) ?? null;
    const amount = rawAmount === null ? null : Number(rawAmount[0].replace(/\s/g, ''));
    const currency = /\$|usd/.test(text) ? 'USD' : /\bруб|₽/.test(text) ? 'RUB' : 'USD';
    const negotiated =
      amount === null || !Number.isFinite(amount) || amount <= 0
        ? null
        : { min: Math.max(0, Math.round(amount * 0.6)), max: Math.round(amount * 0.72), currency };
    return {
      ...base,
      intent: 'PRICE_NEGOTIATION',
      suggestedResponse:
        negotiated === null
          ? `Спасибо за предложение. Мы изучим условия и вернёмся с ответом.`
          : `Спасибо за условия. Для нашего бюджета оптимально ${
              negotiated.min
            }–${negotiated.max} ${currency}. Готовы рассмотреть размещение в этом диапазоне.`,
      strategy:
        negotiated === null
          ? 'Запросить уточнение цены.'
          : `Предложить снижение цены до ${negotiated.min}–${negotiated.max} ${currency}.`,
      recommendedPrice: negotiated,
      fallbackOption: 'Предложить гостевую статью вместо вставки ссылки.',
      risks: ['Цена может оказаться завышенной относительно качества площадки.'],
    };
  }

  return {
    ...base,
    intent: 'NEEDS_CLARIFICATION',
    suggestedResponse: `Спасибо за ответ! Уточните, пожалуйста: ${platformName} готов разместить ссылку на нашу статью?`,
    strategy: 'Запросить уточнение условий площадки.',
    risks: [],
    fallbackOption: 'Отправить повторный запрос с более коротким предложением.',
  };
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
  const mockProviders = NORDHAUS_PROVIDERS.filter(
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
      new MockPlacementProvider(provider.name, nordhausProviderCapabilities(provider.id), options),
    );
  }
  return new InMemoryPlacementProviderRegistry(NORDHAUS_PROVIDERS, bindings, {
    allowMocks: true,
  });
}
