import type { PlacementType } from '@aios/domain';
import type { CompanyAnalysis } from './schemas.js';

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
