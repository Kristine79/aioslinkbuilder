import type { AIAnalysis, AIAnalysisType, AIAnalysisValidationStatus } from '@aios/domain';

export interface AIAnalysisDraft {
  campaignId: string | null;
  analysisType: AIAnalysisType;
  provider: string;
  model: string | null;
  inputReference: Readonly<Record<string, unknown>> | null;
  structuredOutput: Readonly<Record<string, unknown>>;
  schemaVersion: string;
  validationStatus: AIAnalysisValidationStatus;
}

export interface AIAnalysisRepository {
  findByCampaignId(campaignId: string): Promise<AIAnalysis[]>;
  create(draft: AIAnalysisDraft): Promise<AIAnalysis>;
}
