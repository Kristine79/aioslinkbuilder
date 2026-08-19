import type {
  AnchorRecommendationInput,
  CompanyAnalysisInput,
  ContentPreparationInput,
  DonorQualityEstimateInput,
  DonorRiskInput,
  GenerateSearchQueriesInput,
  LinkInsertInput,
  NegotiationReplyInput,
  OpportunityClassificationInput,
  OutreachInput,
  PageAnalysisInput,
  PlacementPlanInput,
} from './types.js';
import type {
  AIPageAnalysis,
  AIAnchorRecommendation,
  AILinkInsert,
  AINegotiationAnalysis,
  AIOutreachMessage,
  CompanyAnalysis,
  ContentDraft,
  DonorQualityEstimates,
  OpportunityClassification,
  AIDonorRisk,
  PlacementPlanDecisionMap,
  SearchQueryPlan,
} from './schemas.js';

/**
 * Abstraction over AI intelligence providers.
 *
 * Implementations may be OpenAI, Anthropic or any other provider. The domain
 * layer never depends on concrete models; all structured output is validated
 * against zod schemas before it can influence business state. Every method
 * returns a *semantic* result (no metric provenance) — the application layer
 * wraps AI results into domain state with the correct MetricStatus (e.g.
 * AI_ESTIMATED).
 */
export interface AIProvider {
  readonly name: string;
  analyzeCompany(input: CompanyAnalysisInput): Promise<CompanyAnalysis>;
  classifyOpportunity(input: OpportunityClassificationInput): Promise<OpportunityClassification>;
  prepareContent(input: ContentPreparationInput): Promise<ContentDraft>;
  analyzePage(input: PageAnalysisInput): Promise<AIPageAnalysis>;
  generateLinkInsert(input: LinkInsertInput): Promise<AILinkInsert>;
  recommendAnchor(input: AnchorRecommendationInput): Promise<AIAnchorRecommendation>;
  generateOutreach(input: OutreachInput): Promise<AIOutreachMessage>;
  analyzeNegotiationReply(input: NegotiationReplyInput): Promise<AINegotiationAnalysis>;
  estimateDonorQuality(input: DonorQualityEstimateInput): Promise<DonorQualityEstimates>;
  assessDonorRisk(input: DonorRiskInput): Promise<AIDonorRisk>;
  /**
   * Builds the campaign placement plan decision map: one decision per
   * discovered opportunity. The AI interprets the existing deterministic
   * signals (score, risk, provider, strategy) and suggests a recommendation
   * bucket, next action, automation level and reasoning. The application
   * layer reconciles every suggestion with the domain before the plan is
   * exposed.
   */
  generatePlacementPlan(input: PlacementPlanInput): Promise<PlacementPlanDecisionMap>;
  /**
   * Produces the web-search discovery plan for a company: relevant research
   * directions with concrete search queries and catalog category hints.
   * The provider returns a structured plan validated against
   * searchQueryPlanSchema; actual web search execution happens outside AI.
   */
  generateSearchQueries(input: GenerateSearchQueriesInput): Promise<SearchQueryPlan>;
}
