export type {
  CompanyAnalysisInput,
  PlatformMetadata,
  OpportunityClassificationInput,
  ContentPreparationInput,
  PageAnalysisInput,
  LinkInsertInput,
  AnchorRecommendationInput,
  OutreachInput,
  NegotiationReplyInput,
  DonorQualityEstimateInput,
  DonorRiskInput,
  PlacementPlanInput,
  PlacementPlanOpportunityInput,
  GenerateSearchQueriesInput,
} from './types.js';
export type {
  AIPageAnalysis,
  AIAnchorRecommendation,
  AILinkInsert,
  AINegotiationAnalysis,
  AIOutreachMessage,
  DonorQualityEstimates,
  AIDonorRisk,
  PlacementPlanDecisionMap,
  PlacementPlanItem,
  SearchQueryPlan,
} from './types.js';

export {
  companyAnalysisSchema,
  opportunityClassificationSchema,
  contentDraftSchema,
  pageAnalysisSchema,
  linkInsertSchema,
  anchorRecommendationSchema,
  outreachMessageSchema,
  negotiationAnalysisSchema,
  donorQualityEstimatesSchema,
  donorRiskSchema,
  placementPlanSchema,
  placementPlanItemSchema,
  searchQueryPlanSchema,
} from './schemas.js';
export type { CompanyAnalysis, OpportunityClassification, ContentDraft } from './schemas.js';

export type { AIProvider } from './provider.js';

export { AIOutputValidationError, validateAIOutput } from './validate.js';

export {
  OpenCodeAIProvider,
  openCodeConfigFromEnv,
  DEFAULT_OPENCODE_MODEL,
} from './providers/opencode-ai-provider.js';
export type { OpenCodeAIProviderConfig } from './providers/opencode-ai-provider.js';
export { OpenCodeClient, OpenCodeClientError } from './providers/opencode-client.js';
export type { OpenCodeClientConfig, ChatMessage } from './providers/opencode-client.js';
export {
  defaultOpenCodeBaseUrl,
  OpenCodeModelConfigError,
  OpenCodeProviderAuthError,
  OpenCodeProviderRateLimitError,
  OpenCodeProviderUnavailableError,
} from './providers/opencode-errors.js';

export { extractCitations } from './search/citations.js';
export type { CitationExtractionResult } from './search/citations.js';
export { parseSearchCapabilities, AI_SEARCH_CAPABILITY_TOKENS } from './search/capabilities.js';
export type { AiSearchCapabilitiesConfig, AiSearchCapabilityToken } from './search/capabilities.js';
export {
  AISearchClient,
  defaultAiSearchBaseUrl,
  defaultAiSearchModel,
} from './search/ai-search-client.js';
export type { AISearchClientConfig, AISearchSearchOptions } from './search/ai-search-client.js';
export {
  AISearchClientError,
  AISearchConfigError,
  AISearchNoCitationsError,
} from './search/ai-search-errors.js';
export { NO_AI_CAPABILITIES } from './search/types.js';
export type {
  AiCitation,
  AiProviderCapabilities,
  AiSearchChatResult,
  AiSearchUsage,
  AiSearchErrorCategory,
} from './search/types.js';
