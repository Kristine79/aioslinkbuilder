import { PLACEMENT_TYPES } from '@aios/domain';
import { z } from 'zod';

export const companyAnalysisSchema = z.strictObject({
  businessType: z.string().min(1),
  topics: z.array(z.string().min(1)),
  audiences: z.array(z.string().min(1)),
  relevantCategories: z.array(z.string().min(1)),
  strategicRecommendations: z.array(z.string().min(1)),
});

export type CompanyAnalysis = z.infer<typeof companyAnalysisSchema>;

export const opportunityClassificationSchema = z.strictObject({
  category: z.string().min(1),
  placementType: z.enum(PLACEMENT_TYPES),
  topicalRelevance: z.number().min(0).max(100),
  audienceMatch: z.number().min(0).max(100),
  geographicRelevance: z.number().min(0).max(100),
  recommendationReason: z.string().min(1),
});

export type OpportunityClassification = z.infer<typeof opportunityClassificationSchema>;

export const contentDraftSchema = z.strictObject({
  content: z.string().min(1),
});

export type ContentDraft = z.infer<typeof contentDraftSchema>;
