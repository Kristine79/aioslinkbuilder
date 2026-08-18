import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const CATEGORIES = [
  {
    id: 'cat-maps-local',
    code: 'maps-local',
    name: 'Карты и локальные каталоги',
    description: 'Картографические сервисы и локальные каталоги организаций',
    sortOrder: 1,
  },
  {
    id: 'cat-furniture-directories',
    code: 'furniture-directories',
    name: 'Мебельные каталоги',
    description: 'Каталоги и справочники мебельных брендов и продукции',
    sortOrder: 2,
  },
  {
    id: 'cat-interior-design',
    code: 'interior-design',
    name: 'Интерьер и дизайн',
    description: 'Журналы, порталы и платформы об интерьерном дизайне',
    sortOrder: 3,
  },
  {
    id: 'cat-architecture',
    code: 'architecture',
    name: 'Архитектура',
    description: 'Архитектурные порталы и сообщества',
    sortOrder: 4,
  },
  {
    id: 'cat-professional-platforms',
    code: 'professional-platforms',
    name: 'Профессиональные площадки',
    description: 'Профессиональные сети и отраслевые B2B-платформы',
    sortOrder: 5,
  },
  {
    id: 'cat-media-pr',
    code: 'media-pr',
    name: 'Медиа и PR',
    description: 'Новостные и редакционные издания, PR-площадки',
    sortOrder: 6,
  },
  {
    id: 'cat-social-platforms',
    code: 'social-platforms',
    name: 'Социальные платформы',
    description: 'Социальные сети и сервисы',
    sortOrder: 7,
  },
  {
    id: 'cat-b2b-regional',
    code: 'b2b-regional',
    name: 'B2B и региональные площадки',
    description: 'Региональные и отраслевые бизнес-платформы',
    sortOrder: 8,
  },
] as const;

const PLATFORMS = [
  {
    id: 'platform-yandex-business',
    name: 'Яндекс Бизнес',
    url: 'https://business.yandex.ru',
    country: 'Russia',
    categoryId: 'cat-maps-local',
    notes: 'Demo platform (synthetic seed data)',
  },
  {
    id: 'platform-2gis',
    name: '2ГИС',
    url: 'https://2gis.ru',
    country: 'Russia',
    categoryId: 'cat-maps-local',
    notes: 'Demo platform (synthetic seed data)',
  },
  {
    id: 'platform-mebel-ru',
    name: 'Мебель.ру',
    url: 'https://mebel.ru',
    country: 'Russia',
    categoryId: 'cat-furniture-directories',
    notes: 'Demo platform (synthetic seed data)',
  },
  {
    id: 'platform-inmyroom',
    name: 'INMYROOM',
    url: 'https://inmyroom.ru',
    country: 'Russia',
    categoryId: 'cat-interior-design',
    notes: 'Demo platform (synthetic seed data)',
  },
  {
    id: 'platform-salon-interior',
    name: 'SALON-interior',
    url: 'https://salon.ru',
    country: 'Russia',
    categoryId: 'cat-interior-design',
    notes: 'Demo platform (synthetic seed data)',
  },
  {
    id: 'platform-archi-ru',
    name: 'Archi.ru',
    url: 'https://archi.ru',
    country: 'Russia',
    categoryId: 'cat-architecture',
    notes: 'Demo platform (synthetic seed data)',
  },
  {
    id: 'platform-houzz',
    name: 'Houzz',
    url: 'https://www.houzz.ru',
    country: 'Russia',
    categoryId: 'cat-interior-design',
    notes: 'Demo platform (synthetic seed data)',
  },
  {
    id: 'platform-vk',
    name: 'VK',
    url: 'https://vk.com',
    country: 'Russia',
    categoryId: 'cat-social-platforms',
    notes: 'Demo platform (synthetic seed data)',
  },
  {
    id: 'platform-zoon',
    name: 'Zoon.ru',
    url: 'https://zoon.ru',
    country: 'Russia',
    categoryId: 'cat-maps-local',
    notes: 'Search-discovered platform (synthetic seed data)',
  },
  {
    id: 'platform-flamp',
    name: 'Flamp',
    url: 'https://flamp.ru',
    country: 'Russia',
    categoryId: 'cat-maps-local',
    notes: 'Search-discovered platform (synthetic seed data)',
  },
  {
    id: 'platform-divan-ru',
    name: 'Divan.ru',
    url: 'https://divan.ru',
    country: 'Russia',
    categoryId: 'cat-furniture-directories',
    notes: 'Search-discovered platform (synthetic seed data)',
  },
  {
    id: 'platform-mebelion',
    name: 'Mebelion',
    url: 'https://mebelion.ru',
    country: 'Russia',
    categoryId: 'cat-furniture-directories',
    notes: 'Search-discovered platform (synthetic seed data)',
  },
  {
    id: 'platform-mebel-ot-fabrik',
    name: 'Мебель от фабрик',
    url: 'https://mebel-ot-fabrik.ru',
    country: 'Russia',
    categoryId: 'cat-furniture-directories',
    notes: 'Search-discovered platform (synthetic seed data)',
  },
  {
    id: 'platform-designmate',
    name: 'Design Mate',
    url: 'https://designmate.ru',
    country: 'Russia',
    categoryId: 'cat-interior-design',
    notes: 'Search-discovered platform (synthetic seed data)',
  },
  {
    id: 'platform-roomble',
    name: 'Roomble',
    url: 'https://roomble.com',
    country: 'Russia',
    categoryId: 'cat-interior-design',
    notes: 'Search-discovered platform (synthetic seed data)',
  },
  {
    id: 'platform-mydecor',
    name: 'MyDecor',
    url: 'https://mydecor.ru',
    country: 'Russia',
    categoryId: 'cat-interior-design',
    notes: 'Search-discovered platform (synthetic seed data)',
  },
  {
    id: 'platform-archspeech',
    name: 'Archspeech',
    url: 'https://archspeech.com',
    country: 'Russia',
    categoryId: 'cat-architecture',
    notes: 'Search-discovered platform (synthetic seed data)',
  },
  {
    id: 'platform-profi-ru',
    name: 'Профи.ру',
    url: 'https://profi.ru',
    country: 'Russia',
    categoryId: 'cat-professional-platforms',
    notes: 'Search-discovered platform (synthetic seed data)',
  },
  {
    id: 'platform-vc-ru',
    name: 'VC.ru',
    url: 'https://vc.ru',
    country: 'Russia',
    categoryId: 'cat-media-pr',
    notes: 'Search-discovered platform (synthetic seed data)',
  },
  {
    id: 'platform-dzen',
    name: 'Дзен',
    url: 'https://dzen.ru',
    country: 'Russia',
    categoryId: 'cat-media-pr',
    notes: 'Search-discovered platform (synthetic seed data)',
  },
] as const;

const PROVIDERS = [
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
] as const;

const COMPANY = {
  id: 'company-nordhaus',
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
};

const CAMPAIGN = {
  id: 'campaign-nordhaus-demo',
  companyId: 'company-nordhaus',
  name: 'Nordhaus Demo Campaign',
  goals: [
    'Продвижение премиального мебельного бренда в интерьерных и дизайнерских каталогах',
    'Создание профилей на картах и в мебельных каталогах',
  ],
  status: 'DRAFT' as const,
};

async function main(): Promise<void> {
  await checkDatabaseReachable();

  let categoryCount = 0;
  for (const category of CATEGORIES) {
    await db.placementCategory.upsert({
      where: { id: category.id },
      create: { ...category },
      update: { ...category },
    });
    categoryCount += 1;
  }

  let platformCount = 0;
  for (const platform of PLATFORMS) {
    await db.platform.upsert({
      where: { id: platform.id },
      create: { ...platform },
      update: { ...platform },
    });
    platformCount += 1;
  }

  let providerCount = 0;
  for (const provider of PROVIDERS) {
    await db.placementProvider.upsert({
      where: { id: provider.id },
      create: { ...provider },
      update: { ...provider },
    });
    providerCount += 1;
  }

  await db.company.upsert({
    where: { id: COMPANY.id },
    create: { ...COMPANY },
    update: { ...COMPANY },
  });

  await db.campaign.upsert({
    where: { id: CAMPAIGN.id },
    create: { ...CAMPAIGN },
    update: { ...CAMPAIGN },
  });

  console.log(
    `Seed completed: ${categoryCount} categories, ${platformCount} platforms, ` +
      `${providerCount} providers, 1 company, 1 campaign`,
  );
}

async function checkDatabaseReachable(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const host = databaseUrl === undefined ? 'unknown' : new URL(databaseUrl).hostname;
  try {
    await withTimeout(db.$queryRaw`SELECT 1`, 10_000);
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Neon database is unreachable (host: ${host}). Seed cannot run. ` +
        `Underlying error: ${cause}`,
    );
  }
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

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
