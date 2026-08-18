import type { AIAnalysis } from '@aios/domain';
import type { AIAnalysisDraft, AIAnalysisRepository } from '@aios/application';

import { randomUUID } from 'node:crypto';

/**
 * In-memory implementation of AIAnalysisRepository. Used by the prototype
 * demo, the API composition and tests; the Prisma repositories remain the
 * production path.
 */
export class InMemoryAIAnalysisRepository implements AIAnalysisRepository {
  readonly analyses = new Map<string, AIAnalysis>();

  findByCampaignId(campaignId: string): Promise<AIAnalysis[]> {
    return Promise.resolve(
      [...this.analyses.values()].filter((analysis) => analysis.campaignId === campaignId),
    );
  }

  findLatestValidCompanyAnalysis(campaignId: string): Promise<AIAnalysis | null> {
    const candidates = [...this.analyses.values()]
      .filter(
        (analysis) =>
          analysis.campaignId === campaignId &&
          analysis.analysisType === 'COMPANY_ANALYSIS' &&
          analysis.validationStatus === 'VALID',
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.resolve(candidates[0] ?? null);
  }

  create(draft: AIAnalysisDraft): Promise<AIAnalysis> {
    const analysis: AIAnalysis = {
      id: randomUUID(),
      campaignId: draft.campaignId,
      analysisType: draft.analysisType,
      provider: draft.provider,
      model: draft.model,
      inputReference: draft.inputReference,
      structuredOutput: draft.structuredOutput,
      schemaVersion: draft.schemaVersion,
      validationStatus: draft.validationStatus,
      createdAt: new Date(),
    };
    this.analyses.set(analysis.id, analysis);
    return Promise.resolve(analysis);
  }
}
