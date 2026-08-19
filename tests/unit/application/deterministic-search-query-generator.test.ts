import { describe, expect, it } from 'vitest';

import { searchQueryPlanSchema } from '@aios/ai';
import { DEFAULT_TEMPLATES, DeterministicSearchQueryGenerator } from '@aios/application';

const AVAILABLE = Object.keys(DEFAULT_TEMPLATES);

describe('DeterministicSearchQueryGenerator', () => {
  it('returns a schema-valid plan for known relevant categories', async () => {
    const generator = new DeterministicSearchQueryGenerator();
    const plan = await generator.generate({
      company: {
        name: 'Nordhaus',
        description: null,
        industry: 'furniture',
        website: null,
        geography: ['Москва', 'Россия'],
        products: ['кухни', 'шкафы-купе'],
        targetAudience: [],
      },
      campaignGoals: ['Каталоги'],
      relevantCategoryCodes: ['furniture-directories', 'media-pr'],
      availableCategoryCodes: AVAILABLE,
    });

    expect(() => searchQueryPlanSchema.parse(plan)).not.toThrow();
    expect(plan.intents.length).toBeGreaterThanOrEqual(1);
    expect(plan.intents.length).toBeLessThanOrEqual(6);
    expect(plan.intents[0]?.categoryCode).toBe('furniture-directories');
    expect(plan.intents.map((intent) => intent.categoryCode)).toContain('media-pr');
    for (const intent of plan.intents) {
      expect(intent.queries.length).toBeGreaterThanOrEqual(1);
      expect(intent.queries.length).toBeLessThanOrEqual(3);
      expect(intent.queries[0]).not.toBe('');
    }
  });

  it('expands industry categories and respects availability caps', async () => {
    const generator = new DeterministicSearchQueryGenerator(DEFAULT_TEMPLATES, {
      furniture: ['furniture-directories'],
    });
    const plan = await generator.generate({
      company: {
        name: 'X',
        description: null,
        industry: 'furniture',
        website: null,
        geography: [],
        products: [],
        targetAudience: [],
      },
      campaignGoals: [],
      relevantCategoryCodes: [],
      availableCategoryCodes: ['furniture-directories'],
    });

    expect(plan.intents[0]?.categoryCode).toBe('furniture-directories');
    expect(plan.intents[0]?.queries[0]).toContain('X');
  });

  it('returns a single fallback intent when nothing is known', async () => {
    const generator = new DeterministicSearchQueryGenerator();
    const plan = await generator.generate({
      company: {
        name: 'Novatech',
        description: null,
        industry: null,
        website: null,
        geography: [],
        products: [],
        targetAudience: [],
      },
      campaignGoals: [],
      relevantCategoryCodes: [],
      availableCategoryCodes: [],
    });

    expect(plan.intents).toHaveLength(1);
    expect(plan.intents[0]?.categoryCode).toBeNull();
    expect(plan.intents[0]?.queries[0]).toContain('Novatech');
  });
});
