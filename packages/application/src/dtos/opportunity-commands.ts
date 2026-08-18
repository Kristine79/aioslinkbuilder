import type { PlacementType } from '@aios/domain';

export interface DiscoverOpportunitiesCommand {
  campaignId: string;
  /**
   * Campaign-scoped placement type for newly discovered opportunities.
   * Classification refines the type per platform from validated AI output.
   */
  placementType: PlacementType;
  /** Restricts discovery to platforms whose category code is listed. */
  categoryCodes?: string[];
}

export interface DeterministicScoreInputs {
  authority?: number;
  placementQuality?: number;
  automationPotential?: number;
}

export interface ClassifyOpportunityCommand {
  opportunityId: string;
  /**
   * Deterministic score dimensions not provided by AI classification.
   * Defaults to the neutral value 50 when absent (unknown = neutral).
   */
  deterministicScores?: DeterministicScoreInputs;
}
