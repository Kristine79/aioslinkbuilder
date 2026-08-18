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
