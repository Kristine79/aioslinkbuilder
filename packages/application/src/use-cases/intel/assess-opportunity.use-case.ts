import type {
  BacklinkProfile,
  DonorQualityProfile,
  DonorRiskAssessment,
  IndexingStatus,
  PageAnalysis,
  PlacementOpportunity,
} from '@aios/domain';
import {
  assessDonorRisk,
  calculateDonorQuality,
  isKnownDatum,
  scoreV2From,
  unknownDatum,
} from '@aios/domain';
import type { AIProvider, CompanyAnalysis } from '@aios/ai';
import {
  companyAnalysisSchema,
  donorQualityEstimatesSchema,
  donorRiskSchema,
  pageAnalysisSchema,
  validateAIOutput,
} from '@aios/ai';

import { NoCompanyAnalysisError, NotFoundError } from '../../errors.js';
import { writeIntel } from '../../intel/metadata.js';
import type { AIAnalysisRepository } from '../../ports/repositories/ai-analysis.repository.js';
import type { AuditLogRepository } from '../../ports/repositories/audit-log.repository.js';
import type { CampaignRepository } from '../../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../../ports/repositories/company.repository.js';
import type { LookupRepository } from '../../ports/repositories/lookup.repository.js';
import type { PlacementOpportunityRepository } from '../../ports/repositories/opportunity.repository.js';
import type { PageAnalysisProvider } from '../../ports/page-analysis-provider.js';
import type { SeoMetricsProvider } from '../../ports/seo-metrics-provider.js';

const INTEL_SCHEMA_VERSION = '1';
const AI_CONFIDENCE = 70;

export interface AssessOpportunityCommand {
  opportunityId: string;
}

/**
 * Assesses an opportunity end-to-end:
 *
 * 1. donor quality profile — measured metrics from the SeoMetricsProvider
 *    (status MEASURED/SYNTHETIC per provider), AI-estimated dimensions
 *    (status AI_ESTIMATED), deterministic overall donor quality score;
 * 2. page-level analysis — provider or AI-estimated page signals;
 * 3. donor risk assessment — deterministic signals, AI context;
 * 4. Opportunity Score 2.0 — deterministic combination of relevance, donor
 *    quality, placement quality, execution and risk.
 *
 * AI supplies dimensions; every final number is computed by the domain layer.
 */
export class AssessOpportunityUseCase {
  constructor(
    private readonly opportunities: PlacementOpportunityRepository,
    private readonly campaigns: CampaignRepository,
    private readonly companies: CompanyRepository,
    private readonly lookups: LookupRepository,
    private readonly analyses: AIAnalysisRepository,
    private readonly aiProvider: AIProvider,
    private readonly seoMetrics: SeoMetricsProvider | null,
    private readonly pageAnalysis: PageAnalysisProvider | null,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(command: AssessOpportunityCommand): Promise<PlacementOpportunity> {
    const opportunity = await this.opportunities.findById(command.opportunityId);
    if (opportunity === null) {
      throw new NotFoundError('PlacementOpportunity', command.opportunityId);
    }
    const campaign = await this.campaigns.findById(opportunity.campaignId);
    if (campaign === null) {
      throw new NotFoundError('Campaign', opportunity.campaignId);
    }
    const company = await this.companies.findById(campaign.companyId);
    if (company === null) {
      throw new NotFoundError('Company', campaign.companyId);
    }
    const platform = await this.loadPlatform(opportunity.platformId);
    const companyAnalysis = await this.loadCompanyAnalysis(opportunity.campaignId);
    // 1. Donor quality.
    const snapshot = this.seoMetrics
      ? await this.seoMetrics.fetchDonorProfile({ platformName: platform.name, url: platform.url })
      : null;
    const estimates = validateAIOutput(
      donorQualityEstimatesSchema,
      await this.aiProvider.estimateDonorQuality({
        platform,
        companyAnalysis,
      }),
      'estimateDonorQuality',
    );
    const donorQuality = this.buildDonorQualityProfile(snapshot, estimates);
    await this.analyses.create({
      campaignId: opportunity.campaignId,
      analysisType: 'DONOR_QUALITY_ESTIMATES',
      provider: this.aiProvider.name,
      model: null,
      inputReference: { platformId: opportunity.platformId },
      structuredOutput: estimates,
      schemaVersion: INTEL_SCHEMA_VERSION,
      validationStatus: 'VALID',
    });

    // 2. Page analysis.
    const page = await this.analyzePage(platform, opportunity.platformId, donorQuality);

    // 3. Risk.
    const deterministicRisk = assessDonorRisk(donorQuality, {
      companyGeography: company.geography,
    });
    const aiRisk = validateAIOutput(
      donorRiskSchema,
      await this.aiProvider.assessDonorRisk({ platform, donorQuality }),
      'assessDonorRisk',
    );
    const risk: DonorRiskAssessment = {
      ...deterministicRisk,
      aiReasons: aiRisk.reasons,
      level:
        deterministicRisk.level === 'UNKNOWN' && aiRisk.level !== 'UNKNOWN'
          ? aiRisk.level
          : deterministicRisk.level,
    };
    await this.analyses.create({
      campaignId: opportunity.campaignId,
      analysisType: 'DONOR_RISK',
      provider: this.aiProvider.name,
      model: null,
      inputReference: { platformId: opportunity.platformId },
      structuredOutput: aiRisk,
      schemaVersion: INTEL_SCHEMA_VERSION,
      validationStatus: 'VALID',
    });

    // 4. Score 2.0 (deterministic).
    const scoreV2 = scoreV2From({
      breakdown: opportunity.scoreBreakdown,
      donorQuality,
      risk,
      placementMethod: opportunity.placementMethod,
      pageLinkInsertSuitability:
        isKnownDatum(page.linkInsertSuitability) &&
        typeof page.linkInsertSuitability.value === 'number'
          ? page.linkInsertSuitability.value
          : null,
    });

    const metadata = writeIntel(opportunity.metadata, {
      donorQuality,
      pageAnalysis: page,
      risk,
      scoreV2,
    });
    const updated = await this.opportunities.update({
      ...opportunity,
      metadata,
      updatedAt: new Date(),
    });

    await this.auditLog.append({
      actor: 'system',
      action: 'OPPORTUNITY_INTEL_ASSESSED',
      entityType: 'PlacementOpportunity',
      entityId: opportunity.id,
      metadata: {
        donorQuality: donorQuality.overallDonorQuality,
        donorLevel: donorQuality.overallLevel,
        riskLevel: risk.level,
        overallScore: scoreV2?.overall ?? null,
        pageAnalysis: page.targetPage,
        seoSource: this.seoMetrics?.name ?? null,
      },
    });

    return updated;
  }

  private async analyzePage(
    platform: { name: string; url: string | null; category: string | null },
    platformId: string,
    donorQuality: DonorQualityProfile,
  ): Promise<PageAnalysis> {
    if (this.pageAnalysis !== null) {
      return this.pageAnalysis.analyzePage({ platformName: platform.name, url: platform.url });
    }
    const output = validateAIOutput(
      pageAnalysisSchema,
      await this.aiProvider.analyzePage({
        company: { name: '', description: null, website: null, products: [] },
        platform,
        donorQuality,
      }),
      'analyzePage',
    );
    await this.analyses.create({
      campaignId: null,
      analysisType: 'PAGE_ANALYSIS',
      provider: this.aiProvider.name,
      model: null,
      inputReference: { platformId },
      structuredOutput: output,
      schemaVersion: INTEL_SCHEMA_VERSION,
      validationStatus: 'VALID',
    });
    return {
      targetDomain: platform.name,
      targetPage: output.targetPage,
      pageTitle: output.pageTitle,
      pageType: output.pageType,
      topicalRelevance: {
        value: output.topicalRelevance,
        source: this.aiProvider.name,
        status: 'AI_ESTIMATED',
        confidence: AI_CONFIDENCE,
        measuredAt: null,
      },
      linkInsertSuitability: {
        value: output.linkInsertSuitability,
        source: this.aiProvider.name,
        status: 'AI_ESTIMATED',
        confidence: AI_CONFIDENCE,
        measuredAt: null,
      },
      indexation: {
        value: output.indexation,
        source: this.aiProvider.name,
        status: 'AI_ESTIMATED',
        confidence: AI_CONFIDENCE,
        measuredAt: null,
      },
      traffic: unknownDatum<number>(),
      outboundLinkSignals: unknownDatum(),
      suggestedPlacementLocation: output.suggestedPlacementLocation,
      summary: output.summary,
      analyzedAt: new Date().toISOString(),
    };
  }

  private buildDonorQualityProfile(
    snapshot: {
      organicTraffic: DonorQualityProfile['organicTraffic'];
      trafficGeography: DonorQualityProfile['trafficGeography'];
      keywordProfile: DonorQualityProfile['keywordProfile'];
      backlinkProfile: DonorQualityProfile['backlinkProfile'];
      authority: DonorQualityProfile['authority'];
      spamRisk: DonorQualityProfile['spamRisk'];
      indexingStatus: DonorQualityProfile['indexingStatus'];
      estimatedRealTraffic: DonorQualityProfile['estimatedRealTraffic'];
    } | null,
    estimates: {
      topicalRelevance: number;
      audienceMatch: number;
      geographicRelevance: number;
      placementQuality: number;
      automationPotential: number;
    },
  ): DonorQualityProfile {
    const estimated = (value: number) => ({
      value,
      source: this.aiProvider.name,
      status: 'AI_ESTIMATED' as const,
      confidence: AI_CONFIDENCE,
      measuredAt: null,
    });

    const profile: DonorQualityProfile = {
      organicTraffic: snapshot ? snapshot.organicTraffic : unknownDatum<number>(),
      trafficGeography: snapshot ? snapshot.trafficGeography : unknownDatum<string[]>(),
      keywordProfile: snapshot ? snapshot.keywordProfile : unknownDatum<string[]>(),
      backlinkProfile: snapshot ? snapshot.backlinkProfile : unknownDatum<BacklinkProfile>(),
      authority: snapshot ? snapshot.authority : unknownDatum<number>(),
      spamRisk: snapshot ? snapshot.spamRisk : unknownDatum<number>(),
      indexingStatus: snapshot ? snapshot.indexingStatus : unknownDatum<IndexingStatus>(),
      estimatedRealTraffic: snapshot ? snapshot.estimatedRealTraffic : unknownDatum<number>(),
      topicalRelevance: estimated(estimates.topicalRelevance),
      audienceMatch: estimated(estimates.audienceMatch),
      geographicRelevance: estimated(estimates.geographicRelevance),
      placementQuality: estimated(estimates.placementQuality),
      automationPotential: estimated(estimates.automationPotential),
      overallDonorQuality: null,
      overallLevel: 'UNKNOWN',
    };
    const computed = calculateDonorQuality(profile);
    return { ...profile, ...computed };
  }

  private async loadPlatform(platformId: string) {
    const platforms = await this.lookups.listPlatforms();
    const platform = platforms.find((candidate) => candidate.id === platformId);
    if (platform === undefined) {
      throw new NotFoundError('Platform', platformId);
    }
    const categories = await this.lookups.listCategories();
    const category = categories.find((candidate) => candidate.id === platform.categoryId);
    return { name: platform.name, url: platform.url, category: category?.name ?? null };
  }

  private async loadCompanyAnalysis(campaignId: string): Promise<CompanyAnalysis> {
    const analysis = await this.analyses.findLatestValidCompanyAnalysis(campaignId);
    if (analysis === null) {
      throw new NoCompanyAnalysisError(campaignId);
    }
    return validateAIOutput(
      companyAnalysisSchema,
      analysis.structuredOutput,
      'stored companyAnalysis',
    );
  }
}
