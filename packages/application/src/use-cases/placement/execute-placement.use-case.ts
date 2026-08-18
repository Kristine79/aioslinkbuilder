import type { Placement, PlacementOpportunity } from '@aios/domain';
import {
  EXECUTION_REQUIRED_CAPABILITIES,
  ValidationError,
  assertTransitionPlacement,
  requireCapability,
  selectBestProvider,
  validatePlacement,
} from '@aios/domain';
import { ProviderError } from '@aios/integrations';

import type { ExecutePlacementCommand } from '../../dtos/placement-commands.js';
import { NoProviderAssignedError, NoProviderAvailableError, NotFoundError } from '../../errors.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';
import type { PlacementRepository } from '../../ports/repositories/placement.repository.js';
import type { PlacementProviderRegistry } from '../../ports/provider-registry.js';

/**
 * Executes a selected opportunity through its placement provider.
 *
 * Preparation (SELECTED -> READY) and submission (READY -> SUBMITTED, or
 * straight to PUBLISHED when the provider reports an immediate publication)
 * happen in one use case. The provider is selected deterministically by the
 * domain alignment logic; unsupported capabilities are explicit
 * (UnsupportedCapabilityError, NoProviderAvailableError).
 *
 * Retry semantics: a failed attempt (placement FAILED) is retried by
 * creating a fresh Placement record — each attempt is its own auditable
 * row. Re-execution is rejected while any previous attempt is still active
 * (SUBMITTED/PUBLISHED/...), so double submission is impossible.
 */
export class ExecutePlacementUseCase {
  constructor(
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly placements: PlacementRepository,
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly providers: PlacementProviderRegistry,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: ExecutePlacementCommand): Promise<Placement> {
    const opportunity = await this.opportunities.findById(command.opportunityId);
    if (opportunity === null) {
      throw new NotFoundError('PlacementOpportunity', command.opportunityId);
    }

    const placement = await this.prepare(opportunity);

    const providerId = placement.providerId;
    if (providerId === null) {
      throw new NoProviderAssignedError(placement.id);
    }
    const executionProvider = await this.providers.resolve(providerId);
    requireCapability(
      executionProvider.capabilities,
      'CREATE',
      `execute placement ${placement.id}`,
    );

    const campaign = await this.campaigns.findById(opportunity.campaignId);
    if (campaign === null) {
      throw new NotFoundError('Campaign', opportunity.campaignId);
    }
    const company = await this.companies.findById(campaign.companyId);
    if (company === null) {
      throw new NotFoundError('Company', campaign.companyId);
    }

    let result: Awaited<ReturnType<typeof executionProvider.create>>;
    try {
      result = await executionProvider.create({
        opportunityId: opportunity.id,
        placementType: opportunity.placementType,
        companyProfile: {
          name: company.name,
          description: company.description,
          website: company.website,
        },
      });
    } catch (error) {
      await this.markFailed(placement, opportunity.id, providerId, error);
      throw error;
    }

    assertTransitionPlacement(placement.status, 'SUBMITTED');
    const published = result.status === 'published';
    if (published) {
      assertTransitionPlacement('SUBMITTED', 'PUBLISHED');
    }
    const now = new Date();
    const executed: Placement = {
      ...placement,
      status: published ? 'PUBLISHED' : 'SUBMITTED',
      externalId: result.externalId,
      submittedAt: now,
      publishedAt: published ? now : null,
      liveUrl: published ? (result.liveUrl ?? placement.liveUrl) : null,
      metadata: { ...placement.metadata, providerStatus: result.status },
      updatedAt: now,
    };
    const saved = await this.placements.save(executed);

    await this.auditLog.append({
      actor: 'system',
      action: published ? 'PLACEMENT_PUBLISHED' : 'PLACEMENT_SUBMITTED',
      entityType: 'Placement',
      entityId: placement.id,
      metadata: {
        opportunityId: opportunity.id,
        providerId: providerId,
        externalId: result.externalId,
        status: executed.status,
      },
    });

    return saved;
  }

  private async prepare(opportunity: PlacementOpportunity): Promise<Placement> {
    const existing = await this.placements.findByOpportunityId(opportunity.id);
    const retrying = opportunity.status === 'READY';
    if (retrying) {
      if (existing.some((placement) => placement.status !== 'FAILED')) {
        throw new ValidationError(
          'Opportunity already has an active placement; a retry is only possible after all previous attempts failed',
        );
      }
    } else {
      assertTransitionPlacement(opportunity.status, 'READY');
    }

    const providers = await this.providers.listByPlatformId(opportunity.platformId);
    const provider = selectBestProvider(providers, EXECUTION_REQUIRED_CAPABILITIES);
    if (provider === null) {
      throw new NoProviderAvailableError(opportunity.platformId);
    }

    validatePlacement({ opportunityId: opportunity.id, providerId: provider.id });
    const placement = await this.placements.create({
      opportunityId: opportunity.id,
      providerId: provider.id,
    });

    if (!retrying) {
      const ready: PlacementOpportunity = {
        ...opportunity,
        status: 'READY',
        updatedAt: new Date(),
      };
      await this.opportunities.update(ready);
      await this.auditLog.append({
        actor: 'system',
        action: 'OPPORTUNITY_READY',
        entityType: 'PlacementOpportunity',
        entityId: opportunity.id,
        metadata: { providerId: provider.id },
      });
    }

    return placement;
  }

  private async markFailed(
    placement: Placement,
    opportunityId: string,
    providerId: string,
    error: unknown,
  ): Promise<void> {
    assertTransitionPlacement(placement.status, 'FAILED');
    await this.placements.save({
      ...placement,
      status: 'FAILED',
      updatedAt: new Date(),
    });
    await this.auditLog.append({
      actor: 'system',
      action: 'PLACEMENT_FAILED',
      entityType: 'Placement',
      entityId: placement.id,
      metadata: {
        opportunityId,
        providerId,
        category: error instanceof ProviderError ? error.category : 'UNKNOWN',
        reason: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
