import type { PlacementMethod, PlacementType, RiskLevel } from '@aios/domain';
import type {
  AIPageAnalysis,
  AIAnchorRecommendation,
  AILinkInsert,
  AINegotiationAnalysis,
  AIOutreachMessage,
  CompanyAnalysis,
  DonorQualityEstimates,
  AIDonorRisk,
  PlacementPlanDecisionMap,
  PlacementPlanItem,
  SearchQueryPlan,
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

/** One discovered opportunity as presented to the plan decision engine. */
export interface PlacementPlanOpportunityInput {
  opportunityId: string;
  platform: PlatformMetadata;
  placementType: PlacementType;
  placementMethod: PlacementMethod;
  status: string;
  /** Deterministic score 1.0 (null when not scored yet). */
  score: number | null;
  /** Deterministic Score 2.0 overall (null when intel was not assessed). */
  overallScore: number | null;
  /** Donor quality overall (null when intel was not assessed). */
  donorQuality: number | null;
  /** Estimated organic traffic when known. */
  traffic: number | null;
  riskLevel: RiskLevel | null;
  providerAvailable: boolean;
  /** Whether the aligned provider's capabilities are verified. */
  providerCapabilitiesVerified: boolean;
  automationAvailable: boolean;
  hasIntel: boolean;
  strategySupportsType: boolean;
}

/** Everything the AI needs to build a placement plan decision map. */
export interface PlacementPlanInput {
  campaign: {
    id: string;
    name: string;
    goals: string[];
  };
  company: {
    name: string;
    industry: string | null;
    description: string | null;
    website: string | null;
    geography: string[];
    products: string[];
    targetAudience: string[];
  };
  companyAnalysis: CompanyAnalysis;
  strategy: Array<{
    categoryCode: string;
    categoryName: string;
    placementType: PlacementType;
  }>;
  opportunities: PlacementPlanOpportunityInput[];
}

/** Company context needed to generate web-search intents for discovery. */
export interface GenerateSearchQueriesInput {
  company: {
    name: string;
    description: string | null;
    industry: string | null;
    website: string | null;
    geography: string[];
    products: string[];
    targetAudience: string[];
  };
  campaignGoals: string[];
  /** Strategy direction codes for this campaign (catalog-backed or AI-derived). */
  relevantCategoryCodes: string[];
  /** Every catalog category code the system knows about. */
  availableCategoryCodes: string[];
}

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
};
