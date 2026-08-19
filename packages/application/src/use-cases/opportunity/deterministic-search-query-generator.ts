import type { GenerateSearchQueriesInput, SearchQueryPlan } from '@aios/ai';

import type { SearchQueryGenerator } from '../../ports/search-query-generator.js';

/** How to build concrete queries for one catalog category. */
export interface CategoryQueryTemplate {
  intent: string;
  build: (products: string, geography: string) => string[];
}

/**
 * Deterministic search-intent generator (demo/offline fallback): derives
 * directions from the company profile and the catalog categories flagged as
 * relevant, then fills generic per-category query templates. The result is
 * validated by construction and never exceeds the query budget.
 */
export class DeterministicSearchQueryGenerator implements SearchQueryGenerator {
  readonly name = 'deterministic-search-intents';

  constructor(
    private readonly templates: Readonly<Record<string, CategoryQueryTemplate>> = DEFAULT_TEMPLATES,
    private readonly industryCategories: Readonly<Record<string, readonly string[]>> = {},
    private readonly defaultCategories: readonly string[] = DEFAULT_FALLBACK_CATEGORIES,
  ) {}

  generate(input: GenerateSearchQueriesInput): Promise<SearchQueryPlan> {
    const industry = normalizeIndustry(input.company.industry, input.company.description);
    const fromIndustry = this.industryCategories[industry] ?? this.defaultCategories;
    const relevant = unique([...input.relevantCategoryCodes, ...fromIndustry]);
    const available = new Set(input.availableCategoryCodes);
    const codes = relevant.filter((code) => available.has(code)).slice(0, 6);

    const geography = input.company.geography[0] ?? 'Россия';
    const products =
      input.company.products.length > 0
        ? input.company.products.slice(0, 3).join(' или ')
        : input.company.name;

    const intents: SearchQueryPlan['intents'] = [];
    for (const code of codes) {
      const template = this.templates[code];
      if (template === undefined) continue;
      intents.push({
        intent: template.intent,
        categoryCode: code,
        queries: template.build(products, geography).slice(0, 3),
      });
    }
    if (intents.length === 0) {
      intents.push({
        intent: `Профильные площадки для «${input.company.name}»`,
        categoryCode: input.availableCategoryCodes[0] ?? null,
        queries: [`${input.company.name} каталоги и справочники ${geography}`],
      });
    }
    return Promise.resolve({ intents });
  }
}

export const DEFAULT_FALLBACK_CATEGORIES = ['professional-platforms', 'media-pr'];

/** Generic query templates for the standard catalog category codes. */
export const DEFAULT_TEMPLATES: Readonly<Record<string, CategoryQueryTemplate>> = {
  'maps-local': {
    intent: 'Карты и локальные каталоги компаний',
    build: (products, geography) => [
      `каталог компаний ${products} ${geography}`,
      `справочник организаций ${geography} ${products}`,
    ],
  },
  'furniture-directories': {
    intent: 'Профильные каталоги',
    build: (products, geography) => [
      `каталог производителей ${products}`,
      `реестр фабрик и мастерских ${products} ${geography}`,
    ],
  },
  'interior-design': {
    intent: 'Интерьерные издания и дизайн-площадки',
    build: (products) => [
      `журнал о дизайне интерьера и ${products} на заказ`,
      `интерьерные издания размещение материалов`,
    ],
  },
  architecture: {
    intent: 'Архитектурные медиа',
    build: (products) => [
      `архитектурный портал мебель и интерьеры`,
      `архитектурные издания о ${products}`,
    ],
  },
  'professional-platforms': {
    intent: 'Профессиональные площадки',
    build: (products) => [
      `площадки специалистов по ${products}`,
      `профили компаний ${products} на агрегаторах услуг`,
    ],
  },
  'media-pr': {
    intent: 'Медиа и PR',
    build: (products) => [
      `отраслевые СМИ о ${products}`,
      `ресурсные страницы и подборки ${products}`,
    ],
  },
  'social-platforms': {
    intent: 'Социальные платформы',
    build: (products) => [
      `сообщества и паблики о ${products}`,
      `платформы отзывов и рекомендаций ${products}`,
    ],
  },
  'b2b-regional': {
    intent: 'B2B и региональные площадки',
    build: (products, geography) => [
      `оптовые и b2b каталоги ${products} ${geography}`,
      `региональные площадки ${geography} ${products}`,
    ],
  },
};

function normalizeIndustry(industry: string | null, description: string | null): string {
  if (industry !== null && industry.trim() !== '') {
    return industry.trim().toLowerCase();
  }
  const text = (description ?? '').toLowerCase();
  if (/(мебел|furniture)/.test(text)) return 'furniture';
  if (/(недвижимост|real estate|жил)/.test(text)) return 'real-estate';
  if (/(программ|software|разработк)/.test(text)) return 'software';
  if (/(дизайн|design)/.test(text)) return 'design';
  if (/(клиник|здоровь|медицин)/.test(text)) return 'health';
  if (/(образован|обучен|курс)/.test(text)) return 'education';
  return industry ?? '';
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
