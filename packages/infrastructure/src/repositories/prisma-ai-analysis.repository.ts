import type { PrismaClient, Prisma } from '@prisma/client';
import type { AIAnalysis } from '@aios/domain';
import type { AIAnalysisDraft, AIAnalysisRepository } from '@aios/application';

import { toDomainMetadata, toPrismaJson } from './mappers.js';

export class PrismaAIAnalysisRepository implements AIAnalysisRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByCampaignId(campaignId: string): Promise<AIAnalysis[]> {
    const rows = await this.db.aIAnalysis.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toAnalysis);
  }

  async findLatestValidCompanyAnalysis(campaignId: string): Promise<AIAnalysis | null> {
    const row = await this.db.aIAnalysis.findFirst({
      where: {
        campaignId,
        analysisType: 'COMPANY_ANALYSIS',
        validationStatus: 'VALID',
      },
      orderBy: { createdAt: 'desc' },
    });
    return row === null ? null : toAnalysis(row);
  }

  async create(draft: AIAnalysisDraft): Promise<AIAnalysis> {
    const row = await this.db.aIAnalysis.create({
      data: {
        campaignId: draft.campaignId,
        analysisType: draft.analysisType,
        provider: draft.provider,
        model: draft.model,
        inputReference: toPrismaJson(draft.inputReference),
        structuredOutput: toPrismaJson(draft.structuredOutput),
        schemaVersion: draft.schemaVersion,
        validationStatus: draft.validationStatus,
      },
    });
    return toAnalysis(row);
  }
}

function toAnalysis(row: Prisma.AIAnalysisGetPayload<Record<string, never>>): AIAnalysis {
  return {
    id: row.id,
    campaignId: row.campaignId,
    analysisType: row.analysisType,
    provider: row.provider,
    model: row.model,
    inputReference: toDomainMetadata(row.inputReference),
    structuredOutput: toDomainMetadata(row.structuredOutput) ?? {},
    schemaVersion: row.schemaVersion,
    validationStatus: row.validationStatus,
    createdAt: row.createdAt,
  };
}
