import type { Placement, Verification } from '@aios/domain';
import { assertTransitionPlacement, requireCapability, validateEvidence } from '@aios/domain';

import type { VerifyPlacementCommand } from '../../dtos/placement-commands.js';
import { NoProviderAssignedError, NotFoundError } from '../../errors.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type {
  EvidenceDraft,
  EvidenceRepository,
} from '../../ports/repositories/evidence.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';
import type { PlacementRepository } from '../../ports/repositories/placement.repository.js';
import type { PlacementProviderRegistry } from '../../ports/provider-registry.js';
import type { VerificationRepository } from '../../ports/repositories/verification.repository.js';

export interface VerifyPlacementResult {
  placement: Placement;
  verification: Verification;
}

/**
 * Verifies a published placement against evidence provided by the provider.
 *
 * The verification passes only when the provider's evidence confirms the
 * expected result (PRD: SUBMITTED is not success; a placement becomes
 * VERIFIED only after evidence confirms the result). State eligibility is
 * checked up front — before any provider call or persistence — so a
 * non-PUBLISHED placement can never trigger an external call or leave an
 * orphan verification record. Every verification attempt stores a
 * Verification record; passing verifications also store structured Evidence
 * entries (live URL and the match results).
 */
export class VerifyPlacementUseCase {
  constructor(
    private readonly placements: PlacementRepository,
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly providers: PlacementProviderRegistry,
    private readonly verifications: VerificationRepository,
    private readonly evidence: EvidenceRepository,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: VerifyPlacementCommand): Promise<VerifyPlacementResult> {
    const placement = await this.placements.findById(command.placementId);
    if (placement === null) {
      throw new NotFoundError('Placement', command.placementId);
    }
    // Eligibility gate: only PUBLISHED placements can be verified. This runs
    // before the provider call and before any persistence, so invalid
    // verification attempts have zero side effects.
    assertTransitionPlacement(placement.status, 'VERIFIED');

    const providerId = placement.providerId;
    if (providerId === null) {
      throw new NoProviderAssignedError(placement.id);
    }
    if (placement.externalId === null) {
      throw new NoProviderAssignedError(placement.id);
    }
    const executionProvider = await this.providers.resolve(providerId);
    requireCapability(executionProvider.capabilities, 'VERIFY', `verify placement ${placement.id}`);

    const opportunity = await this.opportunities.findById(placement.opportunityId);
    if (opportunity === null) {
      throw new NotFoundError('PlacementOpportunity', placement.opportunityId);
    }
    const campaign = await this.campaigns.findById(opportunity.campaignId);
    if (campaign === null) {
      throw new NotFoundError('Campaign', opportunity.campaignId);
    }
    const company = await this.companies.findById(campaign.companyId);
    if (company === null) {
      throw new NotFoundError('Company', campaign.companyId);
    }

    const result = await executionProvider.verify({
      externalId: placement.externalId,
      expected: {
        companyName: company.name,
        website: company.website,
        expectedBacklink: command.expectedBacklink ?? null,
      },
    });

    const checkedAt = new Date();
    const outcome = result.verified ? 'PASSED' : 'FAILED';
    const verification = await this.verifications.create({
      placementId: placement.id,
      status: outcome,
      checkedAt,
      result: {
        verified: result.verified,
        matchedCompanyName: result.matchedCompanyName,
        matchedWebsite: result.matchedWebsite,
        foundBacklink: result.foundBacklink,
        liveUrl: result.liveUrl,
      },
      failureReason: result.verified ? null : result.failureReason,
    });

    if (result.verified) {
      assertTransitionPlacement(placement.status, 'VERIFIED');
      const verified = await this.placements.save({
        ...placement,
        status: 'VERIFIED',
        liveUrl: result.liveUrl ?? placement.liveUrl,
        updatedAt: checkedAt,
      });
      await this.attachEvidence(verification, result);
      await this.auditLog.append({
        actor: 'system',
        action: 'PLACEMENT_VERIFIED',
        entityType: 'Placement',
        entityId: placement.id,
        metadata: { verificationId: verification.id },
      });
      return { placement: verified, verification };
    }

    assertTransitionPlacement(placement.status, 'VERIFICATION_FAILED');
    const failed = await this.placements.save({
      ...placement,
      status: 'VERIFICATION_FAILED',
      updatedAt: checkedAt,
    });
    await this.auditLog.append({
      actor: 'system',
      action: 'PLACEMENT_VERIFICATION_FAILED',
      entityType: 'Placement',
      entityId: placement.id,
      metadata: { verificationId: verification.id, failureReason: result.failureReason },
    });
    return { placement: failed, verification };
  }

  private async attachEvidence(
    verification: Verification,
    result: {
      matchedCompanyName: boolean;
      matchedWebsite: boolean;
      foundBacklink: boolean;
      liveUrl: string | null;
    },
  ): Promise<void> {
    const entries: Array<Omit<EvidenceDraft, 'verificationId'>> = [];
    if (result.liveUrl !== null) {
      entries.push({ type: 'LIVE_URL', url: result.liveUrl, content: null, metadata: null });
    }
    entries.push({
      type: 'COMPANY_MATCH',
      url: null,
      content: null,
      metadata: { matched: result.matchedCompanyName },
    });
    entries.push({
      type: 'WEBSITE_MATCH',
      url: null,
      content: null,
      metadata: { matched: result.matchedWebsite },
    });
    entries.push({
      type: 'BACKLINK_MATCH',
      url: null,
      content: null,
      metadata: { matched: result.foundBacklink },
    });
    for (const entry of entries) {
      validateEvidence({ verificationId: verification.id, ...entry });
      await this.evidence.create({ verificationId: verification.id, ...entry });
    }
  }
}
