/**
 * Scenario intelligence providers and fixtures.
 *
 * Every "measured" metric in the demo is explicitly SYNTHETIC (source
 * "demo") — the status field keeps the fake nature visible so the UI can
 * never present it as a real measurement. Real Ahrefs/Semrush/Similarweb or
 * crawler providers can later be plugged into the same ports and the status
 * becomes MEASURED automatically.
 */

import type {
  BacklinkProfile,
  IndexingStatus,
  PageAnalysis,
} from '@aios/domain';
import { syntheticDatum, unknownDatum } from '@aios/domain';
import type {
  OutreachProvider,
  PageAnalysisProvider,
  SeoMetricsProvider,
  SeoMetricsSnapshot,
} from '@aios/application';

const DEMO_SOURCE = 'demo';
const now = (): string => new Date().toISOString();

interface DonorFixture {
  organicTraffic: number;
  authority: number;
  spamRisk: number;
  indexing: IndexingStatus;
  referringDomains: number;
  totalBacklinks: number;
  geography: string[];
  keywords: string[];
  estimatedRealTraffic: number;
}

/** Curated synthetic donor metrics for the demo platforms. */
export const DONOR_FIXTURES: Readonly<Record<string, DonorFixture>> = {
  'https://business.yandex.ru': {
    organicTraffic: 2_100_000,
    authority: 92,
    spamRisk: 8,
    indexing: 'INDEXED',
    referringDomains: 9_800_000,
    totalBacklinks: 42_000_000,
    geography: ['Россия', 'СНГ'],
    keywords: ['карты', 'организации', 'отзывы'],
    estimatedRealTraffic: 1_900_000,
  },
  'https://2gis.ru': {
    organicTraffic: 860_000,
    authority: 88,
    spamRisk: 10,
    indexing: 'INDEXED',
    referringDomains: 4_200_000,
    totalBacklinks: 18_000_000,
    geography: ['Россия', 'Казахстан'],
    keywords: ['организации', 'карты', 'компании'],
    estimatedRealTraffic: 780_000,
  },
  'https://mebel.ru': {
    organicTraffic: 42_000,
    authority: 46,
    spamRisk: 24,
    indexing: 'INDEXED',
    referringDomains: 12_000,
    totalBacklinks: 90_000,
    geography: ['Россия'],
    keywords: ['мебель', 'мебельные магазины', 'кухни'],
    estimatedRealTraffic: 38_000,
  },
  'https://inmyroom.ru': {
    organicTraffic: 51_000,
    authority: 54,
    spamRisk: 14,
    indexing: 'INDEXED',
    referringDomains: 18_000,
    totalBacklinks: 140_000,
    geography: ['Россия'],
    keywords: ['интерьер', 'дизайн интерьера', 'мебель'],
    estimatedRealTraffic: 46_000,
  },
  'https://salon.ru': {
    organicTraffic: 63_000,
    authority: 61,
    spamRisk: 12,
    indexing: 'INDEXED',
    referringDomains: 26_000,
    totalBacklinks: 210_000,
    geography: ['Россия'],
    keywords: ['интерьер', 'дизайн', 'декор'],
    estimatedRealTraffic: 57_000,
  },
  'https://archi.ru': {
    organicTraffic: 98_000,
    authority: 67,
    spamRisk: 9,
    indexing: 'INDEXED',
    referringDomains: 31_000,
    totalBacklinks: 260_000,
    geography: ['Россия'],
    keywords: ['архитектура', 'архитекторы', 'городская среда'],
    estimatedRealTraffic: 90_000,
  },
  'https://www.houzz.ru': {
    organicTraffic: 125_000,
    authority: 78,
    spamRisk: 6,
    indexing: 'INDEXED',
    referringDomains: 540_000,
    totalBacklinks: 4_800_000,
    geography: ['Россия', 'Мир'],
    keywords: ['дизайн интерьера', 'мебель на заказ', 'кухни'],
    estimatedRealTraffic: 112_000,
  },
  'https://vk.com': {
    organicTraffic: 4_400_000,
    authority: 94,
    spamRisk: 15,
    indexing: 'INDEXED',
    referringDomains: 12_000_000,
    totalBacklinks: 88_000_000,
    geography: ['Россия', 'СНГ'],
    keywords: ['социальные сети', 'сообщества'],
    estimatedRealTraffic: 4_000_000,
  },
  'https://profi.ru': {
    organicTraffic: 120_000,
    authority: 52,
    spamRisk: 65,
    indexing: 'INDEXED',
    referringDomains: 9_000,
    totalBacklinks: 61_000,
    geography: ['Россия'],
    keywords: ['мастера', 'специалисты', 'услуги'],
    estimatedRealTraffic: 95_000,
  },
  'https://archspeech.com': {
    organicTraffic: 44_000,
    authority: 49,
    spamRisk: 45,
    indexing: 'PARTIAL',
    referringDomains: 7_000,
    totalBacklinks: 48_000,
    geography: ['Россия'],
    keywords: ['архитектура', 'девелопмент'],
    estimatedRealTraffic: 30_000,
  },
};

/** Curated synthetic page analysis for the demo editorial platforms. */
export const PAGE_FIXTURES: Readonly<Record<string, PageAnalysis>> = {
  'https://www.houzz.ru': {
    targetDomain: 'www.houzz.ru',
    targetPage: 'https://www.houzz.ru/magazine/ideas/kuhnja-na-zakaz',
    pageTitle: 'Кухня на заказ: 12 идей для премиального интерьера',
    pageType: 'EDITORIAL',
    topicalRelevance: syntheticDatum(94, DEMO_SOURCE),
    linkInsertSuitability: syntheticDatum(91, DEMO_SOURCE),
    indexation: syntheticDatum('INDEXED', DEMO_SOURCE),
    traffic: syntheticDatum(8_400, DEMO_SOURCE),
    outboundLinkSignals: syntheticDatum(
      { total: 24, external: 18, dofollow: 12 },
      DEMO_SOURCE,
    ),
    suggestedPlacementLocation: 'Второй абзац, после упоминания материалов для кухонь',
    summary:
      'Подборка идей для кухни на заказ: материалы, планировка, бренды и советы дизайнеров. Статья открыта для редакционных ссылок на производителей мебели.',
    analyzedAt: now(),
  },
  'https://inmyroom.ru': {
    targetDomain: 'inmyroom.ru',
    targetPage: 'https://inmyroom.ru/posts/kak-vybrat-mebel-dlya-malenkoy-kvartiry',
    pageTitle: 'Как выбрать мебель для маленькой квартиры',
    pageType: 'EDITORIAL',
    topicalRelevance: syntheticDatum(90, DEMO_SOURCE),
    linkInsertSuitability: syntheticDatum(86, DEMO_SOURCE),
    indexation: syntheticDatum('INDEXED', DEMO_SOURCE),
    traffic: syntheticDatum(5_200, DEMO_SOURCE),
    outboundLinkSignals: syntheticDatum(
      { total: 12, external: 9, dofollow: 6 },
      DEMO_SOURCE,
    ),
    suggestedPlacementLocation: 'Третий абзац, в контексте встроенной мебели',
    summary:
      'Гид по выбору мебели для небольших квартир: встроенные шкафы, трансформируемая мебель, советы по экономии пространства.',
    analyzedAt: now(),
  },
  'https://salon.ru': {
    targetDomain: 'salon.ru',
    targetPage: 'https://salon.ru/portfolio/interior/collection-2026',
    pageTitle: 'Коллекция интерьеров 2026: мебель и свет',
    pageType: 'EDITORIAL',
    topicalRelevance: syntheticDatum(88, DEMO_SOURCE),
    linkInsertSuitability: syntheticDatum(84, DEMO_SOURCE),
    indexation: syntheticDatum('INDEXED', DEMO_SOURCE),
    traffic: syntheticDatum(6_900, DEMO_SOURCE),
    outboundLinkSignals: syntheticDatum(
      { total: 16, external: 11, dofollow: 8 },
      DEMO_SOURCE,
    ),
    suggestedPlacementLocation: 'После описания проекта с мягкой мебелью',
    summary:
      'Обзор интерьеров из коллекции журнала: авторские решения, мебель и аксессуары для премиальных пространств.',
    analyzedAt: now(),
  },
  'https://archi.ru': {
    targetDomain: 'archi.ru',
    targetPage: 'https://archi.ru/press/meбель-in-residence',
    pageTitle: 'Мебель в резиденции: производство и интерьеры',
    pageType: 'EDITORIAL',
    topicalRelevance: syntheticDatum(82, DEMO_SOURCE),
    linkInsertSuitability: syntheticDatum(79, DEMO_SOURCE),
    indexation: syntheticDatum('INDEXED', DEMO_SOURCE),
    traffic: syntheticDatum(7_100, DEMO_SOURCE),
    outboundLinkSignals: syntheticDatum(
      { total: 9, external: 7, dofollow: 4 },
      DEMO_SOURCE,
    ),
    suggestedPlacementLocation: 'Внутри раздела «Производство и интерьеры»',
    summary:
      'Редакционный материал о производстве мебели и её роли в архитектурных интерьерах.',
    analyzedAt: now(),
  },
  'https://designmate.ru': {
    targetDomain: 'designmate.ru',
    targetPage: 'https://designmate.ru/articles/kuhni-premium-klassa',
    pageTitle: 'Кухни премиум-класса: бренды и технологии',
    pageType: 'EDITORIAL',
    topicalRelevance: syntheticDatum(89, DEMO_SOURCE),
    linkInsertSuitability: syntheticDatum(87, DEMO_SOURCE),
    indexation: syntheticDatum('INDEXED', DEMO_SOURCE),
    traffic: syntheticDatum(3_800, DEMO_SOURCE),
    outboundLinkSignals: syntheticDatum(
      { total: 14, external: 10, dofollow: 7 },
      DEMO_SOURCE,
    ),
    suggestedPlacementLocation: 'Первый абзац, после вводного текста о рынке',
    summary:
      'Обзор премиальных кухонь: технологии производства, материалы, ведущие фабрики и бренды.',
    analyzedAt: now(),
  },
  'https://roomble.com': {
    targetDomain: 'roomble.com',
    targetPage: 'https://roomble.com/ideas/sdelat/sovremennaya-vstraivaemaya-mebel',
    pageTitle: 'Современная встроенная мебель: идеи и решения',
    pageType: 'EDITORIAL',
    topicalRelevance: syntheticDatum(87, DEMO_SOURCE),
    linkInsertSuitability: syntheticDatum(83, DEMO_SOURCE),
    indexation: syntheticDatum('INDEXED', DEMO_SOURCE),
    traffic: syntheticDatum(4_400, DEMO_SOURCE),
    outboundLinkSignals: syntheticDatum(
      { total: 18, external: 13, dofollow: 9 },
      DEMO_SOURCE,
    ),
    suggestedPlacementLocation: 'Раздел «Встроенные шкафы»',
    summary:
      'Идеи по встроенной мебели: шкафы-купе, гардеробные, мебель для ниш и экономия пространства.',
    analyzedAt: now(),
  },
};

const BASE_SEARCH_FIXTURE: DonorFixture = {
  organicTraffic: 30_000,
  authority: 45,
  spamRisk: 20,
  indexing: 'INDEXED',
  referringDomains: 8_000,
  totalBacklinks: 60_000,
  geography: ['Россия'],
  keywords: ['мебель', 'интерьер'],
  estimatedRealTraffic: 27_000,
};

function hash(value: string): number {
  let result = 0;
  for (const char of value) {
    result = (result * 31 + char.charCodeAt(0)) | 0;
  }
  return Math.abs(result);
}

/** Deterministic synthetic donor snapshot for any platform. */
function deterministicSnapshot(platformName: string, url: string | null): SeoMetricsSnapshot {
  const key = url ?? platformName;
  const h = hash(key);
  const fixture: DonorFixture = {
    ...BASE_SEARCH_FIXTURE,
    organicTraffic: 15_000 + (h % 60_000),
    authority: 35 + (h % 30),
    spamRisk: 10 + (h % 25),
    referringDomains: 3_000 + (h % 12_000),
    totalBacklinks: 20_000 + (h % 90_000),
  };
  return snapshotFromFixture(fixture, platformName, url, key);
}

function snapshotFromFixture(
  fixture: DonorFixture,
  platformName: string,
  url: string | null,
  key: string,
): SeoMetricsSnapshot {
  const backlinks: BacklinkProfile = {
    referringDomains: fixture.referringDomains,
    totalBacklinks: fixture.totalBacklinks,
    dofollowRatio: 0.55 + (hash(`${key}:df`) % 35) / 100,
  };
  return {
    platformName,
    url,
    organicTraffic: syntheticDatum(fixture.organicTraffic, DEMO_SOURCE),
    trafficGeography: syntheticDatum([...fixture.geography], DEMO_SOURCE),
    keywordProfile: syntheticDatum([...fixture.keywords], DEMO_SOURCE),
    backlinkProfile: syntheticDatum(backlinks, DEMO_SOURCE),
    authority: syntheticDatum(fixture.authority, DEMO_SOURCE),
    spamRisk: syntheticDatum(fixture.spamRisk, DEMO_SOURCE),
    indexingStatus: syntheticDatum(fixture.indexing, DEMO_SOURCE),
    estimatedRealTraffic: syntheticDatum(fixture.estimatedRealTraffic, DEMO_SOURCE),
    fetchedAt: now(),
  };
}

/** Mock SEO metrics provider: SYNTHETIC data, clearly labeled. */
export class ScenarioSeoMetricsProvider implements SeoMetricsProvider {
  readonly name = 'demo-seo-metrics';
  fetchDonorProfile(input: {
    platformName: string;
    url: string | null;
  }): Promise<SeoMetricsSnapshot> {
    const fixture = input.url === null ? undefined : DONOR_FIXTURES[input.url];
    const key = input.url ?? input.platformName;
    return Promise.resolve(
      fixture === undefined
        ? deterministicSnapshot(input.platformName, input.url)
        : snapshotFromFixture(fixture, input.platformName, input.url, key),
    );
  }
}

/** Mock page analysis provider: curated synthetic pages for the demo. */
export class ScenarioPageAnalysisProvider implements PageAnalysisProvider {
  readonly name = 'demo-page-analysis';
  analyzePage(input: {
    platformName: string;
    url: string | null;
  }): Promise<PageAnalysis> {
    const fixture = input.url === null ? undefined : PAGE_FIXTURES[input.url];
    if (fixture !== undefined) {
      return Promise.resolve(fixture);
    }
    const h = hash(input.platformName);
    return Promise.resolve({
      targetDomain: new URL(input.url ?? 'https://demo.example').hostname,
      targetPage: input.url,
      pageTitle: input.platformName,
      pageType: 'PROFILE',
      topicalRelevance: syntheticDatum(80, DEMO_SOURCE),
      linkInsertSuitability: syntheticDatum(70, DEMO_SOURCE),
      indexation: syntheticDatum<IndexingStatus>('INDEXED', DEMO_SOURCE),
      traffic: unknownDatum<number>(),
      outboundLinkSignals: syntheticDatum(
        { total: 5 + (h % 15), external: 3 + (h % 10), dofollow: 2 + (h % 6) },
        DEMO_SOURCE,
      ),
      suggestedPlacementLocation: 'Страница профиля компании',
      summary: `Площадка «${input.platformName}» — профиль компании.`,
      analyzedAt: now(),
    });
  }
}

/** Mock outreach/messaging provider (human-in-the-loop send). */
export class ScenarioOutreachProvider implements OutreachProvider {
  readonly name = 'demo-outreach';
  send(input: { to: string; subject: string; body: string }): Promise<{
    externalId: string;
    sentAt: string;
  }> {
    return Promise.resolve({
      externalId: `outreach-${hash(`${input.to}:${input.subject}`)}`,
      sentAt: now(),
    });
  }
}

/** The example donor reply used by the demo negotiation flow. */
export const DEMO_DONOR_REPLY =
  'Добрый день! Спасибо за предложение. Мы можем разместить ссылку в статье за $250.';
