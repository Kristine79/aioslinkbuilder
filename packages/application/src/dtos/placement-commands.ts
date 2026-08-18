export interface ApproveOpportunityCommand {
  opportunityId: string;
}

export interface ExecutePlacementCommand {
  opportunityId: string;
}

export interface MonitorPlacementCommand {
  placementId: string;
}

export interface VerifyPlacementCommand {
  placementId: string;
  /**
   * Expected backlink URL for BACKLINK placements. When null, backlink
   * presence is not part of the verification criteria.
   */
  expectedBacklink?: string | null;
}
