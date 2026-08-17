import type { AIAnalysisType, AIAnalysisValidationStatus } from '../enums/ai-analysis.js';

export interface AIAnalysis {
  id: string;
  campaignId: string | null;
  analysisType: AIAnalysisType;
  provider: string;
  model: string | null;
  inputReference: Readonly<Record<string, unknown>> | null;
  structuredOutput: Readonly<Record<string, unknown>>;
  schemaVersion: string;
  validationStatus: AIAnalysisValidationStatus;
  createdAt: Date;
}
