import type { GenerateSearchQueriesInput, SearchQueryPlan } from '@aios/ai';

/**
 * Port for search-intent planning used by real web discovery.
 *
 * The generator decides which research directions (and concrete queries) are
 * worth running for a company. Real deployments use an LLM-backed generator;
 * a deterministic fallback is provided for demo/offline runs. The web search
 * execution itself stays in the discovery source — this port only plans.
 */
export interface SearchQueryGenerator {
  readonly name: string;
  generate(input: GenerateSearchQueriesInput): Promise<SearchQueryPlan>;
}

export type { GenerateSearchQueriesInput, SearchQueryPlan };
