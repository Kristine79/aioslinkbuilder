import type { PrismaClient, Prisma } from '@prisma/client';
import type { OpportunityDraft, PlacementOpportunity, ScoreBreakdown } from '@aios/domain';
import type { PlacementOpportunityRepository } from '@aios/application';

import { toDomainCapabilities, toDomainMetadata, toPrismaJson } from './mappers.js';

export class PrismaPlacementOpportunityRepository implements PlacementOpportunityRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<PlacementOpportunity | null> {
    const row = await this.db.placementOpportunity.findUnique({ where: { id } });
    return row === null ? null : toOpportunity(row);
  }

  async findByCampaignId(campaignId: string): Promise<PlacementOpportunity[]> {
    const rows = await this.db.placementOpportunity.findMany({ where: { campaignId } });
    return rows.map(toOpportunity);
  }

  async findByCampaignIdAndPlatformId(
    campaignId: string,
    platformId: string,
  ): Promise<PlacementOpportunity | null> {
    const row = await this.db.placementOpportunity.findUnique({
      where: { campaignId_platformId: { campaignId, platformId } },
    });
    return row === null ? null : toOpportunity(row);
  }

  async create(draft: OpportunityDraft): Promise<PlacementOpportunity> {
    const row = await this.db.placementOpportunity.create({
      data: {
        campaignId: draft.campaignId,
        platformId: draft.platformId,
        categoryId: draft.categoryId ?? null,
        placementType: draft.placementType,
        placementMethod: draft.placementMethod,
        metadata: toPrismaJson(draft.metadata ?? null),
      },
    });
    return toOpportunity(row);
  }

  async update(opportunity: PlacementOpportunity): Promise<PlacementOpportunity> {
    const row = await this.db.placementOpportunity.update({
      where: { id: opportunity.id },
      data: {
        categoryId: opportunity.categoryId,
        placementType: opportunity.placementType,
        relevance: opportunity.relevance,
        score: opportunity.score,
        scoreBreakdown: toPrismaJson(
          opportunity.scoreBreakdown as Readonly<Record<string, unknown>> | null,
        ),
        recommendation: opportunity.recommendation,
        whyRecommended: opportunity.whyRecommended,
        placementMethod: opportunity.placementMethod,
        providerCapabilities: [...opportunity.providerCapabilities],
        status: opportunity.status,
        metadata: toPrismaJson(opportunity.metadata),
      },
    });
    return toOpportunity(row);
  }
}

function toOpportunity(
  row: Prisma.PlacementOpportunityGetPayload<Record<string, never>>,
): PlacementOpportunity {
  return {
    id: row.id,
    campaignId: row.campaignId,
    platformId: row.platformId,
    categoryId: row.categoryId,
    placementType: row.placementType,
    relevance: row.relevance,
    score: row.score,
    scoreBreakdown: toDomainScoreBreakdown(row.scoreBreakdown),
    recommendation: row.recommendation,
    whyRecommended: row.whyRecommended,
    placementMethod: row.placementMethod,
    providerCapabilities: toDomainCapabilities(row.providerCapabilities),
    status: row.status,
    metadata: toDomainMetadata(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDomainScoreBreakdown(value: Prisma.JsonValue | null): ScoreBreakdown | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const dimensions: (keyof ScoreBreakdown)[] = [
    'topicalRelevance',
    'audienceMatch',
    'geographicRelevance',
    'authority',
    'placementQuality',
    'automationPotential',
    'total',
  ];
  if (!dimensions.every((dimension) => typeof record[dimension] === 'number')) {
    return null;
  }
  return record as unknown as ScoreBreakdown;
}
