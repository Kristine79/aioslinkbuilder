export interface RequestManualPlacementCommand {
  opportunityId: string;
  /**
   * What the human must do (e.g. "complete the partner application on the
   * platform"). Mandatory: a placement is marked NEEDS_MANUAL only with a
   * reason, so the audit trail stays self-explanatory.
   */
  reason: string;
}

export interface CompleteManualPlacementCommand {
  placementId: string;
  /**
   * Reference of the placed entity on the platform (used as the external id
   * for later verification). Mandatory: verification requires an external
   * reference.
   */
  externalId: string;
  /** Public URL of the placed profile/listing/editorial piece. */
  liveUrl: string;
  /** Optional human notes recorded in the placement metadata. */
  notes?: string;
}
