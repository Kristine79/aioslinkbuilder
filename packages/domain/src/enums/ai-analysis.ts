export const AI_ANALYSIS_TYPES = [
  'COMPANY_ANALYSIS',
  'OPPORTUNITY_CLASSIFICATION',
  'CONTENT_PREPARATION',
] as const;

export type AIAnalysisType = (typeof AI_ANALYSIS_TYPES)[number];

export const AI_ANALYSIS_VALIDATION_STATUSES = ['VALID', 'INVALID'] as const;

export type AIAnalysisValidationStatus = (typeof AI_ANALYSIS_VALIDATION_STATUSES)[number];
