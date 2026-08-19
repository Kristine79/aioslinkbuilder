import { DomainError } from '@aios/domain';

export class NotFoundError extends DomainError {
  constructor(
    readonly entityType: string,
    readonly entityId: string,
  ) {
    super(`${entityType} with id "${entityId}" not found`);
  }
}

export class NoCompanyAnalysisError extends DomainError {
  constructor(readonly campaignId: string) {
    super(`No valid company analysis found for campaign "${campaignId}"`);
  }
}

export class NoProviderAvailableError extends DomainError {
  constructor(readonly platformId: string) {
    super(
      `No placement provider with the required capabilities found for platform "${platformId}"`,
    );
  }
}

export class NoProviderAssignedError extends DomainError {
  constructor(readonly placementId: string) {
    super(`Placement "${placementId}" has no provider assigned`);
  }
}

export class PlanGenerationFailedError extends DomainError {
  constructor(
    readonly campaignId: string,
    reason: string,
  ) {
    super(`Placement plan generation failed for campaign "${campaignId}": ${reason}`);
  }
}

export class NoPlacementPlanError extends DomainError {
  constructor(readonly campaignId: string) {
    super(`No placement plan generated for campaign "${campaignId}"`);
  }
}
