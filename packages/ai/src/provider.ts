import type {
  AnchorRecommendationInput,
  CompanyAnalysisInput,
  ContentPreparationInput,
  DonorQualityEstimateInput,
  DonorRiskInput,
  LinkInsertInput,
  NegotiationReplyInput,
  OpportunityClassificationInput,
  OutreachInput,
  PageAnalysisInput,
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
}
