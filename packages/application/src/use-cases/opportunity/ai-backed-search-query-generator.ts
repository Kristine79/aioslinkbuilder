import type { AIProvider, GenerateSearchQueriesInput, SearchQueryPlan } from '@aios/ai';
import { searchQueryPlanSchema, validateAIOutput } from '@aios/ai';

import type { SearchQueryGenerator } from '../../ports/search-query-generator.js';

/**
 * LLM-backed search-intent generator: delegates to the AIProvider and
 * validates the result against searchQueryPlanSchema. Malformed plans never
 * reach the discovery source — they surface as AI output validation errors.
 */
export class AIBackedSearchQueryGenerator implements SearchQueryGenerator {
  readonly name: string;

  constructor(private readonly aiProvider: AIProvider) {
    this.name = `${aiProvider.name}-search-intents`;
  }

  async generate(input: GenerateSearchQueriesInput): Promise<SearchQueryPlan> {
    const raw = await this.aiProvider.generateSearchQueries(input);
    return validateAIOutput(searchQueryPlanSchema, raw, 'generateSearchQueries');
  }
}
