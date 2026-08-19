import type {
  Campaign,
  Company,
  PlacementOpportunity,
  PlacementPlan,
  PlacementProvider,
  PlanDecisionItem,
} from '@aios/domain';
import {
  EXECUTION_REQUIRED_CAPABILITIES,
  buildPlanSummary,
  pickRecommendedToStart,
  placementTypeForCategory,
  reconcilePlanDecision,
  selectBestProvider,
  type PlanDecisionAiSuggestion,
} from '@aios/domain';
import type { CompanyAnalysis, PlacementPlanDecisionMap, PlacementPlanInput } from '@aios/ai';
import { companyAnalysisSchema, validateAIOutput } from '@aios/ai';

import { NoCompanyAnalysisError, NotFoundError } from '../errors.js';
import type { AIAnalysisRepository } from '../ports/repositories/ai-analysis.repository.js';
import type { CampaignRepository } from '../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../ports/repositories/company.repository.js';
import type { LookupRepository } from '../ports/repositories/lookup.repository.js';
import type { PlacementOpportunityRepository } from '../ports/repositories/opportunity.repository.js';
import { readIntel } from '../intel/metadata.js';

export const PLAN_SCHEMA_VERSION = '1';

export interface PlanRow {
  opportunity: PlacementOpportunity;
  platform: { id: string; name: string; url: string | null; categoryId: string | null };
  categoryName: string | null;
  score: number | null;
  overallScore: number | null;
  donorQuality: number | null;
  traffic: number | null;
  riskLevel: PlanDecisionItem['riskLevel'];
  hasIntel: boolean;
  providerAvailable: boolean;
  providerCapabilitiesVerified: boolean;
  strategySupportsType: boolean;
}

export interface PlanData {
  campaign: Campaign;
  company: Company;
  companyAnalysis: CompanyAnalysis;
  strategyItems: Array<{
    categoryCode: string;
    categoryName: string;
    placementType: PlacementPlanInput['strategy'][number]['placementType'];
  }>;
  rows: PlanRow[];
}

/**
 * Loads every deterministic signal the placement plan needs: the campaign,
 * company, validated company analysis, the campaign strategy and all
 * discovered opportunities with their score, intel, risk and provider
 * alignment. The plan operates ONLY on already-discovered opportunities —
 * it never invents new ones.
 */
export async function loadPlanData(
  deps: {
    campaigns: CampaignRepository;
    companies: CompanyRepository;
    analyses: AIAnalysisRepository;
    lookups: LookupRepository;
    opportunities: PlacementOpportunityRepository;
  },
  campaignId: string,
): Promise<PlanData> {
  const campaign = await deps.campaigns.findById(campaignId);
  if (campaign === null) {
    throw new NotFoundError('Campaign', campaignId);
  }
  const company = await deps.companies.findById(campaign.companyId);
  if (company === null) {
    throw new NotFoundError('Company', campaign.companyId);
  }
  const analysis = await deps.analyses.findLatestValidCompanyAnalysis(campaignId);
  if (analysis === null) {
    throw new NoCompanyAnalysisError(campaignId);
  }
  const companyAnalysis = validateAIOutput(
    companyAnalysisSchema,
    analysis.structuredOutput,
    'stored companyAnalysis',
  );

  const [categories, platforms, providers, opportunities] = await Promise.all([
    deps.lookups.listCategories(),
    deps.lookups.listPlatforms(),
    deps.lookups.listProviders(),
    deps.opportunities.findByCampaignId(campaignId),
  ]);

  const relevantCodes = new Set(
    companyAnalysis.relevantCategories.map((code) => code.trim().toLowerCase()),
  );
  const strategyItems = categories
    .filter((category) => relevantCodes.has(category.code.toLowerCase()))
    .map((category) => ({
      categoryCode: category.code,
      categoryName: category.name,
      placementType: placementTypeForCategory(category),
    }));

  const platformById = new Map(platforms.map((platform) => [platform.id, platform]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const providersByPlatform = new Map<string, typeof providers>();
  for (const provider of providers) {
    const existing = providersByPlatform.get(provider.platformId) ?? [];
    existing.push(provider);
    providersByPlatform.set(provider.platformId, existing);
  }

  const rows: PlanRow[] = opportunities.map((opportunity) => {
    const platform = platformById.get(opportunity.platformId);
    const category =
      opportunity.categoryId === null ? undefined : categoryById.get(opportunity.categoryId);
    const intel = readIntel(opportunity.metadata);
    const strategyItem =
      category === undefined
        ? undefined
        : strategyItems.find((item) => item.categoryCode === category.code);
    const alignment = providerAlignment(
      opportunity,
      providersByPlatform.get(opportunity.platformId) ?? [],
    );
    return {
      opportunity,
      platform: {
        id: platform?.id ?? opportunity.platformId,
        name: platform?.name ?? opportunity.platformId,
        url: platform?.url ?? null,
        categoryId: platform?.categoryId ?? null,
      },
      categoryName: category?.name ?? null,
      score: opportunity.score,
      overallScore: intel.scoreV2?.overall ?? null,
      donorQuality: intel.donorQuality?.overallDonorQuality ?? null,
      traffic:
        typeof intel.donorQuality?.organicTraffic?.value === 'number'
          ? intel.donorQuality.organicTraffic.value
          : null,
      riskLevel: intel.risk?.level ?? null,
      hasIntel: intel.donorQuality !== null || intel.pageAnalysis !== null,
      providerAvailable: alignment.providerAvailable,
      providerCapabilitiesVerified: alignment.capabilitiesVerified,
      strategySupportsType:
        strategyItem !== undefined && strategyItem.placementType === opportunity.placementType,
    };
  });

  return { campaign, company, companyAnalysis, strategyItems, rows };
}

/** Provider alignment for the plan: MANUAL method needs only VERIFY. */
function providerAlignment(
  opportunity: PlacementOpportunity,
  providers: readonly PlacementProvider[],
): { providerAvailable: boolean; capabilitiesVerified: boolean } {
  if (opportunity.placementMethod === 'OUTREACH') {
    return { providerAvailable: true, capabilitiesVerified: true };
  }
  const required =
    opportunity.placementMethod === 'MANUAL'
      ? (['VERIFY'] as const)
      : EXECUTION_REQUIRED_CAPABILITIES;
  const selected = selectBestProvider(providers, required);
  return {
    providerAvailable: selected !== null,
    capabilitiesVerified: selected?.capabilitiesVerified ?? false,
  };
}

/** Builds the AI input for the plan decision engine (one batch operation). */
export function planAiInput(data: PlanData): PlacementPlanInput {
  return {
    campaign: {
      id: data.campaign.id,
      name: data.campaign.name,
      goals: [...data.campaign.goals],
    },
    company: {
      name: data.company.name,
      industry: data.company.industry,
      description: data.company.description,
      website: data.company.website,
      geography: [...data.company.geography],
      products: [...data.company.products],
      targetAudience: [...data.company.targetAudience],
    },
    companyAnalysis: data.companyAnalysis,
    strategy: data.strategyItems.map((item) => ({
      categoryCode: item.categoryCode,
      categoryName: item.categoryName,
      placementType: item.placementType,
    })),
    opportunities: data.rows.map((row) => ({
      opportunityId: row.opportunity.id,
      platform: {
        name: row.platform.name,
        url: row.platform.url,
        category: row.categoryName,
      },
      placementType: row.opportunity.placementType,
      placementMethod: row.opportunity.placementMethod,
      status: row.opportunity.status,
      score: row.score,
      overallScore: row.overallScore,
      donorQuality: row.donorQuality,
      traffic: row.traffic,
      riskLevel: row.riskLevel,
      providerAvailable: row.providerAvailable,
      providerCapabilitiesVerified: row.providerCapabilitiesVerified,
      automationAvailable:
        row.opportunity.placementMethod === 'API' ||
        row.opportunity.placementMethod === 'BROWSER' ||
        row.opportunity.placementMethod === 'OUTREACH',
      hasIntel: row.hasIntel,
      strategySupportsType: row.strategySupportsType,
    })),
  };
}

export interface PlanBuildMeta {
  provider: string;
  model: string | null;
  schemaVersion: string;
  generatedAt: Date;
}

/**
 * Reconciles the AI decision map with the deterministic domain state and
 * assembles the final placement plan. Every item keeps its deterministic
 * score; the bucket/action/automation are the reconciled decisions.
 */
export function buildPlacementPlan(
  data: PlanData,
  decisionMap: PlacementPlanDecisionMap,
  meta: PlanBuildMeta,
): PlacementPlan {
  const aiByOpportunityId = new Map(decisionMap.items.map((item) => [item.opportunityId, item]));

  const items: PlanDecisionItem[] = data.rows
    .map((row) => {
      const ai = aiByOpportunityId.get(row.opportunity.id);
      if (ai === undefined) {
        return null;
      }
      const suggestion: PlanDecisionAiSuggestion = {
        recommendation: ai.recommendation,
        recommendationReason: ai.recommendationReason,
        nextAction: ai.nextAction,
        automationLevel: ai.automationLevel,
        riskExplanation: ai.riskExplanation,
        suggestedPlacementApproach: ai.suggestedPlacementApproach,
      };
      const intel = readIntel(row.opportunity.metadata);
      return {
        opportunityId: row.opportunity.id,
        platformId: row.platform.id,
        platformName: row.platform.name,
        placementType: row.opportunity.placementType,
        placementMethod: row.opportunity.placementMethod,
        score: row.score,
        overallScore: row.overallScore,
        donorQuality: row.donorQuality,
        riskLevel: row.riskLevel,
        providerAvailable: row.providerAvailable,
        decision: reconcilePlanDecision(
          {
            score: row.score,
            overallScore: row.overallScore,
            riskLevel: row.riskLevel,
            placementMethod: row.opportunity.placementMethod,
            placementType: row.opportunity.placementType,
            providerAvailable: row.providerAvailable,
            providerCapabilitiesVerified: row.providerCapabilitiesVerified,
            hasIntel: row.hasIntel,
            strategySupportsType: row.strategySupportsType,
          },
          suggestion,
        ),
        anchorRecommendation:
          ai.anchorRecommendation === null
            ? intel.anchorStrategy === null
              ? null
              : {
                  anchorType: intel.anchorStrategy.anchorType,
                  anchor: intel.anchorStrategy.anchor,
                  explanation: intel.anchorStrategy.explanation,
                }
            : {
                anchorType: ai.anchorRecommendation.anchorType,
                anchor: ai.anchorRecommendation.anchor,
                explanation: ai.anchorRecommendation.explanation,
              },
      };
    })
    .filter((item): item is PlanDecisionItem => item !== null);

  const sorted = sortPlanItems(items);
  const summary = buildPlanSummary(sorted);
  return {
    campaignId: data.campaign.id,
    generatedAt: meta.generatedAt,
    provider: meta.provider,
    model: meta.model,
    schemaVersion: meta.schemaVersion,
    summary,
    recommendedToStart: pickRecommendedToStart(sorted),
    items: sorted,
  };
}

/** Ensures the AI decision map covers every discovered opportunity exactly. */
export function assertDecisionMapCoverage(
  opportunityIds: readonly string[],
  decisionMap: PlacementPlanDecisionMap,
): void {
  const inputIds = new Set(opportunityIds);
  const outputIds = decisionMap.items.map((item) => item.opportunityId);
  const hasUnknown = outputIds.some((id) => !inputIds.has(id));
  if (outputIds.length !== inputIds.size || hasUnknown) {
    throw new PlanCoverageError(
      'decision map does not match the opportunity set (missing or unknown opportunity ids)',
    );
  }
}

export class PlanCoverageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanCoverageError';
  }
}

/** Display order: RECOMMENDED first, then review, insufficient, rejected. */
function sortPlanItems(items: PlanDecisionItem[]): PlanDecisionItem[] {
  const priority: Readonly<Record<string, number>> = {
    RECOMMENDED: 0,
    REVIEW_REQUIRED: 1,
    INSUFFICIENT_DATA: 2,
    NOT_RECOMMENDED: 3,
  };
  return [...items].sort(
    (a, b) =>
      (priority[a.decision.recommendation] ?? 9) - (priority[b.decision.recommendation] ?? 9) ||
      (b.overallScore ?? b.score ?? -1) - (a.overallScore ?? a.score ?? -1) ||
      a.platformName.localeCompare(b.platformName),
  );
}
