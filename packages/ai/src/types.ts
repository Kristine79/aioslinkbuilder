import type { PlacementType } from '@aios/domain';
import type {
  AIPageAnalysis,
  AIAnchorRecommendation,
  AILinkInsert,
  AINegotiationAnalysis,
  AIOutreachMessage,
  CompanyAnalysis,
  DonorQualityEstimates,
  AIDonorRisk,
} from './schemas.js';

export interface CompanyAnalysisInput {
  companyName: string;
  description: string | null;
  industry: string | null;
  geography: string[];
  locations: string[];
  products: string[];
  targetAudience: string[];
  website: string | null;
  campaignGoals: string[];
}

export interface PlatformMetadata {
  name: string;
  url: string | null;
  category: string | null;
}

export interface OpportunityClassificationInput {
  platform: PlatformMetadata;
  pageMetadata: Readonly<Record<string, unknown>> | null;
  companyAnalysis: CompanyAnalysis;
}

export interface ContentPreparationInput {
  company: {
    name: string;
    description: string | null;
    website: string | null;
    products: string[];
  };
  platformName: string;
  placementType: PlacementType;
}

export interface PageAnalysisInput {
  company: {
    name: string;
    description: string | null;
    website: string | null;
    products: string[];
  };
  platform: PlatformMetadata;
  /** Donor quality context for the domain being analyzed. */
  donorQuality: unknown;
}

export interface LinkInsertInput {
  company: {
    name: string;
    website: string | null;
    products: string[];
  };
  platform: PlatformMetadata;
  targetPage: string | null;
  surroundingContext: string | null;
  targetUrl: string;
  desiredAnchor: string | null;
  placementObjective: string;
}

export interface AnchorRecommendationInput {
  companyName: string;
  platformName: string;
  targetPage: string | null;
  surroundingContext: string | null;
  placementObjective: string;
  targetKeyword: string | null;
  anchorProfileAvailable: boolean;
  /** Topic relevance of the target page (0-100), when known. */
  targetPageRelevance?: number | null;
}

export interface OutreachInput {
  company: {
    name: string;
    description: string | null;
    website: string | null;
    products: string[];
  };
  platform: PlatformMetadata;
  placementType: PlacementType;
  goals: string[];
  /** Donor page context (what the link would sit next to). */
  pageTitle: string | null;
  pageSummary: string | null;
  anchor: string | null;
  linkInsertText: string | null;
}

export interface NegotiationReplyInput {
  donorReply: string;
  company: { name: string; website: string | null };
  platformName: string;
  placementType: PlacementType;
  campaignGoals: string[];
}

export interface DonorQualityEstimateInput {
  platform: PlatformMetadata;
  companyAnalysis: CompanyAnalysis;
}

export interface DonorRiskInput {
  platform: PlatformMetadata;
  donorQuality: unknown;
}

export type {
  AIPageAnalysis,
  AIAnchorRecommendation,
  AILinkInsert,
  AINegotiationAnalysis,
  AIOutreachMessage,
  DonorQualityEstimates,
  AIDonorRisk,
};
