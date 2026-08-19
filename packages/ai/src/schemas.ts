import {
  ANCHOR_TYPES,
  NEGOTIATION_INTENTS,
  PAGE_TYPES,
  PLACEMENT_TYPES,
  RISK_LEVELS,
} from '@aios/domain';
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

export const pageAnalysisSchema = z.strictObject({
  targetPage: z.string().min(1),
  pageTitle: z.string().min(1),
  pageType: z.enum(PAGE_TYPES),
  topicalRelevance: z.number().min(0).max(100),
  linkInsertSuitability: z.number().min(0).max(100),
  indexation: z.enum(['INDEXED', 'PARTIAL', 'NOT_INDEXED']),
  suggestedPlacementLocation: z.string().min(1),
  summary: z.string().min(1),
});

export type AIPageAnalysis = z.infer<typeof pageAnalysisSchema>;

export const linkInsertSchema = z.strictObject({
  anchor: z.string().min(1),
  anchorAlternatives: z.array(z.string().min(1)).min(2).max(3),
  suggestedInsertionPoint: z.string().min(1),
  text: z.string().min(1),
  explanation: z.string().min(1),
  confidence: z.number().min(0).max(100),
});

export type AILinkInsert = z.infer<typeof linkInsertSchema>;

export const anchorRecommendationSchema = z.strictObject({
  anchorType: z.enum(ANCHOR_TYPES),
  anchor: z.string().min(1),
  alternatives: z.array(z.string().min(1)).min(1),
  explanation: z.string().min(1),
  confidence: z.number().min(0).max(100),
});

export type AIAnchorRecommendation = z.infer<typeof anchorRecommendationSchema>;

export const outreachMessageSchema = z.strictObject({
  subject: z.string().min(1),
  message: z.string().min(1),
  shortVersion: z.string().min(1),
  opening: z.string().min(1),
  valueProposition: z.string().min(1),
  placementRequest: z.string().min(1),
  cta: z.string().min(1),
});

export type AIOutreachMessage = z.infer<typeof outreachMessageSchema>;

export const negotiationAnalysisSchema = z.strictObject({
  intent: z.enum(NEGOTIATION_INTENTS),
  suggestedResponse: z.string().min(1),
  strategy: z.string().min(1),
  recommendedPrice: z
    .strictObject({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
      currency: z.string().min(1),
    })
    .nullable(),
  fallbackOption: z.string().nullable(),
  risks: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(100),
});

export type AINegotiationAnalysis = z.infer<typeof negotiationAnalysisSchema>;

export const donorQualityEstimatesSchema = z.strictObject({
  topicalRelevance: z.number().min(0).max(100),
  audienceMatch: z.number().min(0).max(100),
  geographicRelevance: z.number().min(0).max(100),
  placementQuality: z.number().min(0).max(100),
  automationPotential: z.number().min(0).max(100),
  overallAssessment: z.string().min(1),
});

export type DonorQualityEstimates = z.infer<typeof donorQualityEstimatesSchema>;

export const donorRiskSchema = z.strictObject({
  level: z.enum(RISK_LEVELS),
  reasons: z.array(z.string().min(1)),
});

export type AIDonorRisk = z.infer<typeof donorRiskSchema>;
