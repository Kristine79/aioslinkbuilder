import type { PlacementMethod } from '../enums/placement-method.js';
import type { PlacementStatus } from '../enums/placement-status.js';
import type { PlacementType } from '../enums/placement-type.js';
import type { ProviderCapability } from '../enums/provider-capability.js';
import type { ScoreBreakdown } from '../scoring.js';

export interface PlacementOpportunity {
  id: string;
  campaignId: string;
  platformId: string;
  categoryId: string | null;
  placementType: PlacementType;
  relevance: string | null;
  score: number | null;
  scoreBreakdown: ScoreBreakdown | null;
  recommendation: string | null;
  whyRecommended: string | null;
  placementMethod: PlacementMethod;
  providerCapabilities: readonly ProviderCapability[];
  status: PlacementStatus;
  metadata: Readonly<Record<string, unknown>> | null;
  createdAt: Date;
  updatedAt: Date;
}
