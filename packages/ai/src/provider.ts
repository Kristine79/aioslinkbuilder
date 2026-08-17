import type {
  CompanyAnalysisInput,
  ContentPreparationInput,
  OpportunityClassificationInput,
} from './types.js';
import type { CompanyAnalysis, ContentDraft, OpportunityClassification } from './schemas.js';

/**
 * Abstraction over AI intelligence providers.
 *
 * Implementations may be OpenAI, Anthropic or any other provider. The domain
 * layer never depends on concrete models; all structured output is validated
 * against zod schemas before it can influence business state.
 */
export interface AIProvider {
  readonly name: string;
  analyzeCompany(input: CompanyAnalysisInput): Promise<CompanyAnalysis>;
  classifyOpportunity(input: OpportunityClassificationInput): Promise<OpportunityClassification>;
  prepareContent(input: ContentPreparationInput): Promise<ContentDraft>;
}