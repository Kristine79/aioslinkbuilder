import type { CompanyAnalysis } from '@aios/ai';
import { companyAnalysisSchema, validateAIOutput } from '@aios/ai';
import type { AIProvider } from '@aios/ai';

import type { AnalyzeCompanyCommand } from '../../dtos/analysis-commands.js';
import { NotFoundError } from '../../errors.js';
import type { AIAnalysisRepository } from '../../ports/repositories/ai-analysis.repository.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';

/** Version of the company analysis schema contract stored on AIAnalysis records. */
const COMPANY_ANALYSIS_SCHEMA_VERSION = '1';

/**
 * Runs the AI company analysis for a campaign and stores the validated
 * structured result.
 *
 * AI output is schema-validated before it can influence business state
 * (AI_WORKFLOWS.md). Only VALID analyses are stored; the campaign's latest
 * valid analysis is used by the strategy and classification flows.
 */
export class AnalyzeCompanyUseCase {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly aiProvider: AIProvider,
    private readonly analyses: AIAnalysisRepository,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: AnalyzeCompanyCommand): Promise<CompanyAnalysis> {
    const campaign = await this.campaigns.findById(command.campaignId);
    if (campaign === null) {
      throw new NotFoundError('Campaign', command.campaignId);
    }
    const company = await this.companies.findById(campaign.companyId);
    if (company === null) {
      throw new NotFoundError('Company', campaign.companyId);
    }

    const raw = await this.aiProvider.analyzeCompany({
      companyName: company.name,
      description: company.description,
      industry: company.industry,
      geography: company.geography,
      locations: company.locations,
      products: company.products,
      targetAudience: company.targetAudience,
      website: company.website,
      campaignGoals: campaign.goals,
    });
    const validated = validateAIOutput(companyAnalysisSchema, raw, 'analyzeCompany');

    await this.analyses.create({
      campaignId: campaign.id,
      analysisType: 'COMPANY_ANALYSIS',
      provider: this.aiProvider.name,
      model: null,
      inputReference: { companyId: company.id, campaignId: campaign.id },
      structuredOutput: validated,
      schemaVersion: COMPANY_ANALYSIS_SCHEMA_VERSION,
      validationStatus: 'VALID',
    });

    await this.auditLog.append({
      actor: 'system',
      action: 'COMPANY_ANALYZED',
      entityType: 'Campaign',
      entityId: campaign.id,
      metadata: { companyId: company.id, provider: this.aiProvider.name },
    });

    return validated;
  }
}
