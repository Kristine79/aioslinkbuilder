export type {
  CompanyAnalysisInput,
  PlatformMetadata,
  OpportunityClassificationInput,
  ContentPreparationInput,
} from './types.js';

export {
  companyAnalysisSchema,
  opportunityClassificationSchema,
  contentDraftSchema,
} from './schemas.js';
export type {
  CompanyAnalysis,
  OpportunityClassification,
  ContentDraft,
} from './schemas.js';

export type { AIProvider } from './provider.js';

export { AIOutputValidationError, validateAIOutput } from './validate.js';