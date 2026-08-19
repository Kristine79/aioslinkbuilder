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
} from './types.js';
export type {
  AIPageAnalysis,
  AIAnchorRecommendation,
  AILinkInsert,
  AINegotiationAnalysis,
  AIOutreachMessage,
  DonorQualityEstimates,
  AIDonorRisk,
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
} from './schemas.js';
export type {
  CompanyAnalysis,
  OpportunityClassification,
  ContentDraft,
} from './schemas.js';

export type { AIProvider } from './provider.js';

export { AIOutputValidationError, validateAIOutput } from './validate.js';
