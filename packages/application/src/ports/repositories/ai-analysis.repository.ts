import type { AIAnalysis } from '@aios/domain';

export interface AIAnalysisRepository {
  findByCampaignId(campaignId: string): Promise<AIAnalysis[]>;
  save(analysis: AIAnalysis): Promise<AIAnalysis>;
}
