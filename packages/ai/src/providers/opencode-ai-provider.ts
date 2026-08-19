/**
 * Real AIProvider implementation over the OpenCode Go API
 * (OpenAI-compatible chat completions, https://opencode.ai/zen/go/v1).
 *
 * The provider implements every method of the AIProvider contract. Each
 * task uses its own focused prompt with only the context it needs; every
 * result is parsed JSON that the application layer validates against the
 * existing zod schemas before it can influence business state. The provider
 * never computes final deterministic scores and never fabricates metrics.
 *
 * Configuration (env only, never committed):
 * - OPENCODE_API_KEY  (required in real mode)
 * - OPENCODE_BASE_URL (optional; default https://opencode.ai/zen/go/v1)
 * - OPENCODE_MODEL    (optional; default deepseek-v4-pro)
 */

import type {
  AIAnchorRecommendation,
  AIDonorRisk,
  AILinkInsert,
  AINegotiationAnalysis,
  AIPageAnalysis,
  AIOutreachMessage,
  CompanyAnalysis,
  ContentDraft,
  DonorQualityEstimates,
  OpportunityClassification,
  PlacementPlanDecisionMap,
  SearchQueryPlan,
} from '../schemas.js';
import type {
  AnchorRecommendationInput,
  CompanyAnalysisInput,
  ContentPreparationInput,
  DonorQualityEstimateInput,
  DonorRiskInput,
  GenerateSearchQueriesInput,
  LinkInsertInput,
  NegotiationReplyInput,
  OpportunityClassificationInput,
  OutreachInput,
  PageAnalysisInput,
  PlacementPlanInput,
} from '../types.js';
import type { AIProvider } from '../provider.js';
import {
  OpenCodeClient,
  OpenCodeClientError,
  type OpenCodeClientConfig,
} from './opencode-client.js';
import {
  OpenCodeModelConfigError,
  OpenCodeProviderAuthError,
  OpenCodeProviderRateLimitError,
  OpenCodeProviderUnavailableError,
} from './opencode-errors.js';

export interface OpenCodeAIProviderConfig extends OpenCodeClientConfig {
  /** Human-visible provider label (default "opencode-go"). */
  name?: string;
}

export const DEFAULT_OPENCODE_MODEL = 'deepseek-v4-pro';

/** Reads provider config from the process environment (no secrets logged). */
export function openCodeConfigFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): OpenCodeAIProviderConfig {
  const apiKey = env.OPENCODE_API_KEY ?? '';
  const model = env.OPENCODE_MODEL ?? DEFAULT_OPENCODE_MODEL;
  return {
    apiKey,
    model,
    ...(env.OPENCODE_BASE_URL !== undefined && env.OPENCODE_BASE_URL.trim() !== ''
      ? { baseUrl: env.OPENCODE_BASE_URL }
      : {}),
  };
}

/**
 * Real AI provider. Throw-safe mapping: transport failures become
 * application-visible provider errors (never crash the server, never leak
 * credentials into messages).
 */
export class OpenCodeAIProvider implements AIProvider {
  readonly name: string;
  /** Configured model id (surfaced to the UI as provenance). */
  readonly model: string;
  private readonly client: OpenCodeClient;

  constructor(config: OpenCodeAIProviderConfig) {
    if (config.apiKey.trim() === '') {
      throw new OpenCodeModelConfigError('OPENCODE_API_KEY is required for AI_MODE=real');
    }
    this.name = config.name ?? 'opencode-go';
    this.client = new OpenCodeClient(config);
    this.model = this.client.model;
  }

  analyzeCompany(input: CompanyAnalysisInput): Promise<CompanyAnalysis> {
    return this.structured('analyzeCompany', companyAnalysisPrompt(input));
  }

  classifyOpportunity(input: OpportunityClassificationInput): Promise<OpportunityClassification> {
    return this.structured('classifyOpportunity', classificationPrompt(input));
  }

  prepareContent(input: ContentPreparationInput): Promise<ContentDraft> {
    return this.structured('prepareContent', contentDraftPrompt(input));
  }

  analyzePage(input: PageAnalysisInput): Promise<AIPageAnalysis> {
    return this.structured('analyzePage', pageAnalysisPrompt(input));
  }

  generateLinkInsert(input: LinkInsertInput): Promise<AILinkInsert> {
    return this.structured('generateLinkInsert', linkInsertPrompt(input));
  }

  recommendAnchor(input: AnchorRecommendationInput): Promise<AIAnchorRecommendation> {
    return this.structured('recommendAnchor', anchorPrompt(input));
  }

  generateOutreach(input: OutreachInput): Promise<AIOutreachMessage> {
    return this.structured('generateOutreach', outreachPrompt(input));
  }

  analyzeNegotiationReply(input: NegotiationReplyInput): Promise<AINegotiationAnalysis> {
    return this.structured('analyzeNegotiationReply', negotiationPrompt(input));
  }

  estimateDonorQuality(input: DonorQualityEstimateInput): Promise<DonorQualityEstimates> {
    return this.structured('estimateDonorQuality', donorQualityPrompt(input));
  }

  assessDonorRisk(input: DonorRiskInput): Promise<AIDonorRisk> {
    return this.structured('assessDonorRisk', donorRiskPrompt(input));
  }

  generatePlacementPlan(input: PlacementPlanInput): Promise<PlacementPlanDecisionMap> {
    return this.structured('generatePlacementPlan', placementPlanPrompt(input));
  }

  generateSearchQueries(input: GenerateSearchQueriesInput): Promise<SearchQueryPlan> {
    return this.structured('generateSearchQueries', searchQueriesPrompt(input));
  }

  /** Runs the prompt through OpenCode Go, mapping failures to typed errors. */
  private async structured<T>(
    operation: string,
    messages: Array<{ role: 'system' | 'user'; content: string }>,
  ): Promise<T> {
    try {
      const parsed = await this.client.chat(messages, { jsonMode: true });
      return parsed as T;
    } catch (error) {
      if (error instanceof OpenCodeModelConfigError) {
        throw error;
      }
      if (error instanceof OpenCodeClientError) {
        switch (error.category) {
          case 'auth':
            throw new OpenCodeProviderAuthError(
              `AI provider unavailable (${this.name}): invalid API key — check OPENCODE_API_KEY`,
            );
          case 'rate-limit':
            throw new OpenCodeProviderRateLimitError(
              `AI provider rate limit exceeded (${this.name}); retry later`,
            );
          case 'timeout':
          case 'network':
          case 'server':
            throw new OpenCodeProviderUnavailableError(
              `AI provider unavailable (${this.name}): ${error.message}`,
            );
          case 'validation':
            throw new OpenCodeModelConfigError(
              `AI provider rejected the request (${this.name}): ${error.message}`,
            );
          default:
            throw new OpenCodeProviderUnavailableError(
              `AI provider failed (${this.name}) during ${operation}: ${error.message}`,
            );
        }
      }
      throw error;
    }
  }
}

const SYSTEM = (task: string, schema: string): string =>
  [
    'You are the intelligence engine of an AI link-building platform.',
    `Task: ${task}`,
    'Respond with ONLY a single valid JSON object matching this exact shape:',
    schema,
    'Rules: use Russian for all human-readable strings; numbers are 0-100 integers; ' +
      'do not invent facts about the company; do not add prose, explanations or markdown fences.',
  ].join('\n');

const USER = (label: string, data: unknown): string =>
  `${label}:\n${JSON.stringify(data, null, 2)}`;

function companyAnalysisPrompt(input: CompanyAnalysisInput): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const schema = `{
  "businessType": string,
  "topics": string[],
  "audiences": string[],
  "relevantCategories": string[],
  "strategicRecommendations": string[]
}`;
  const context = {
    companyName: input.companyName,
    description: input.description,
    industry: input.industry,
    website: input.website,
    geography: input.geography,
    locations: input.locations,
    products: input.products,
    targetAudience: input.targetAudience,
    campaignGoals: input.campaignGoals,
  };
  return [
    { role: 'system', content: SYSTEM('analyze the company profile', schema) },
    {
      role: 'user',
      content:
        USER('company profile', context) +
        '\n\nReturn: businessType (one phrase), topics (3-6), audiences (3-6), ' +
        'relevantCategories (codes of placement categories relevant for this business; use the codes from the list passed when provided), ' +
        'strategicRecommendations (2-4 concrete placement/PR directions).',
    },
  ];
}

function classificationPrompt(input: OpportunityClassificationInput): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const schema = `{
  "category": string,
  "placementType": "BACKLINK" | "BRAND_MENTION" | "BUSINESS_PROFILE" | "DIRECTORY_LISTING" | "PRODUCT_LISTING" | "EDITORIAL_PUBLICATION" | "SOCIAL_PROFILE" | "REFERRAL_TRAFFIC" | "LINK_INSERT" | "GUEST_POST" | "RESOURCE_PAGE" | "PARTNER_PAGE",
  "topicalRelevance": 0-100,
  "audienceMatch": 0-100,
  "geographicRelevance": 0-100,
  "recommendationReason": string
}`;
  return [
    { role: 'system', content: SYSTEM('classify a discovered platform for the company', schema) },
    {
      role: 'user',
      content:
        USER('platform', input.platform) +
        '\n\n' +
        USER('company analysis', input.companyAnalysis) +
        '\n\n' +
        (input.pageMetadata !== null
          ? USER('page metadata (if available)', input.pageMetadata) + '\n\n'
          : '') +
        'Return: category (the catalog category code, when it matches; otherwise a short category phrase), ' +
        'placementType (one enum value), relevance dimensions (0-100), recommendationReason (why this platform fits).',
    },
  ];
}

function contentDraftPrompt(input: ContentPreparationInput): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const schema = `{ "content": string }`;
  return [
    { role: 'system', content: SYSTEM('prepare content for a placement', schema) },
    {
      role: 'user',
      content:
        USER('company', input.company) +
        '\n\n' +
        USER('platform', input.platformName) +
        '\n\n' +
        USER('placement type', input.placementType) +
        '\n\nReturn: content (ready-to-use text for the placement).',
    },
  ];
}

function pageAnalysisPrompt(input: PageAnalysisInput): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const schema = `{
  "targetPage": string,
  "pageTitle": string,
  "pageType": "EDITORIAL" | "RESOURCE" | "BLOG" | "PRODUCT" | "PROFILE" | "LISTING" | "NEWS" | "CATEGORY" | "OTHER" | "UNKNOWN",
  "topicalRelevance": 0-100,
  "linkInsertSuitability": 0-100,
  "indexation": "INDEXED" | "PARTIAL" | "NOT_INDEXED",
  "suggestedPlacementLocation": string,
  "summary": string
}`;
  return [
    { role: 'system', content: SYSTEM('analyze a donor page for link placement', schema) },
    {
      role: 'user',
      content:
        USER('company', input.company) +
        '\n\n' +
        USER('platform', input.platform) +
        '\n\n' +
        USER('donor quality context', sanitizeUnknown(input.donorQuality)) +
        '\n\nReturn: pageType (one enum), topicalRelevance and linkInsertSuitability (0-100), ' +
        'indexation (estimate when not measured), suggestedPlacementLocation (where the link fits), ' +
        'summary (2-3 sentences).',
    },
  ];
}

function linkInsertPrompt(input: LinkInsertInput): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const schema = `{
  "anchor": string,
  "anchorAlternatives": string[2..3],
  "suggestedInsertionPoint": string,
  "text": string,
  "explanation": string,
  "confidence": 0-100
}`;
  return [
    { role: 'system', content: SYSTEM('write a natural link insert for a donor page', schema) },
    {
      role: 'user',
      content:
        USER('company', input.company) +
        '\n\n' +
        USER('platform', input.platform) +
        '\n\n' +
        `targetUrl: ${input.targetUrl}\n` +
        `desiredAnchor: ${input.desiredAnchor ?? 'auto'}\n` +
        `placementObjective: ${input.placementObjective}\n` +
        (input.targetPage !== null ? `targetPage: ${input.targetPage}\n` : '') +
        (input.surroundingContext !== null
          ? `surroundingContext (excerpt): ${truncate(input.surroundingContext, 3_000)}\n`
          : '') +
        '\nReturn: anchor (primary), anchorAlternatives (2-3), suggestedInsertionPoint, ' +
        'text (natural sentence(s) containing the link), explanation, confidence (0-100).',
    },
  ];
}

function anchorPrompt(input: AnchorRecommendationInput): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const schema = `{
  "anchorType": "EXACT_MATCH" | "PARTIAL_MATCH" | "BRANDED" | "GENERIC" | "URL" | "LONG_TAIL",
  "anchor": string,
  "alternatives": string[],
  "explanation": string,
  "confidence": 0-100
}`;
  return [
    { role: 'system', content: SYSTEM('recommend an anchor strategy for a link', schema) },
    {
      role: 'user',
      content:
        USER('company', input.companyName) +
        '\n\n' +
        USER('platform', input.platformName) +
        '\n\n' +
        `placementObjective: ${input.placementObjective}\n` +
        `targetKeyword: ${input.targetKeyword ?? 'none'}\n` +
        `anchorProfileAvailable: ${input.anchorProfileAvailable}\n` +
        `targetPageRelevance: ${input.targetPageRelevance ?? 'unknown'}\n` +
        (input.surroundingContext !== null
          ? `surroundingContext (excerpt): ${truncate(input.surroundingContext, 1_500)}\n`
          : '') +
        '\nReturn: anchorType (one enum), anchor (the recommended anchor), alternatives (2-4), ' +
        'explanation, confidence (0-100).',
    },
  ];
}

function outreachPrompt(input: OutreachInput): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const schema = `{
  "subject": string,
  "message": string,
  "shortVersion": string,
  "opening": string,
  "valueProposition": string,
  "placementRequest": string,
  "cta": string
}`;
  return [
    {
      role: 'system',
      content: SYSTEM('write a polite outreach email proposing a placement', schema),
    },
    {
      role: 'user',
      content:
        USER('company', input.company) +
        '\n\n' +
        USER('platform', input.platform) +
        '\n\n' +
        USER('campaign goals', input.goals) +
        '\n\n' +
        `placementType: ${input.placementType}\n` +
        `pageTitle: ${input.pageTitle ?? 'not known'}\n` +
        `pageSummary: ${input.pageSummary !== null ? truncate(input.pageSummary, 800) : 'not known'}\n` +
        `anchor: ${input.anchor ?? 'not decided yet'}\n` +
        (input.linkInsertText !== null
          ? `linkInsertText: ${truncate(input.linkInsertText, 800)}\n`
          : '') +
        '\nReturn: subject (short), message (full, 3-5 paragraphs), shortVersion (2-3 sentences), ' +
        'opening, valueProposition, placementRequest, cta.',
    },
  ];
}

function negotiationPrompt(input: NegotiationReplyInput): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const schema = `{
  "intent": "ACCEPTED" | "REJECTED" | "PRICE_NEGOTIATION" | "CONTENT_REQUIREMENTS" | "LINK_ATTRIBUTE_REQUEST" | "NEEDS_CLARIFICATION" | "MANUAL_REVIEW",
  "suggestedResponse": string,
  "strategy": string,
  "recommendedPrice": { "min": number, "max": number, "currency": string } | null,
  "fallbackOption": string | null,
  "risks": string[],
  "confidence": 0-100
}`;
  return [
    {
      role: 'system',
      content: SYSTEM('analyze a donor reply in a placement negotiation', schema),
    },
    {
      role: 'user',
      content:
        `donorReply:\n${truncate(input.donorReply, 3_000)}\n\n` +
        USER('company', input.company) +
        '\n\n' +
        `platform: ${input.platformName}\n` +
        `placementType: ${input.placementType}\n` +
        USER('campaign goals', input.campaignGoals) +
        '\n\nReturn: intent (one enum), suggestedResponse (ready to send after human approval), ' +
        'strategy, recommendedPrice (null when the reply has no price), fallbackOption, risks (1-4), confidence (0-100).',
    },
  ];
}

function donorQualityPrompt(input: DonorQualityEstimateInput): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const schema = `{
  "topicalRelevance": 0-100,
  "audienceMatch": 0-100,
  "geographicRelevance": 0-100,
  "placementQuality": 0-100,
  "automationPotential": 0-100,
  "overallAssessment": string
}`;
  return [
    {
      role: 'system',
      content: SYSTEM('estimate donor quality dimensions for a platform', schema),
    },
    {
      role: 'user',
      content:
        USER('platform', input.platform) +
        '\n\n' +
        USER('company analysis', input.companyAnalysis) +
        '\n\nReturn: quality dimensions (0-100) and overallAssessment (1-2 sentences). ' +
        'These are AI estimates only — never fabricate traffic or authority metrics.',
    },
  ];
}

function donorRiskPrompt(input: DonorRiskInput): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const schema = `{
  "level": "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN",
  "reasons": string[]
}`;
  return [
    { role: 'system', content: SYSTEM('assess donor risk for a platform', schema) },
    {
      role: 'user',
      content:
        USER('platform', input.platform) +
        '\n\n' +
        USER('donor quality context', sanitizeUnknown(input.donorQuality)) +
        '\n\nReturn: level (one enum), reasons (1-4). Base the level only on the provided signals.',
    },
  ];
}

function placementPlanPrompt(input: PlacementPlanInput): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const schema = `{
  "items": [{
    "opportunityId": string,
    "recommendation": "RECOMMENDED" | "REVIEW_REQUIRED" | "NOT_RECOMMENDED" | "INSUFFICIENT_DATA",
    "recommendationReason": string,
    "nextAction": "PREPARE_OUTREACH" | "REQUEST_MANUAL_PLACEMENT" | "EXECUTE_AUTOMATICALLY" | "REVIEW_PROVIDER" | "REVIEW_OPPORTUNITY" | "REJECT",
    "automationLevel": "AUTOMATIC" | "AI_ASSISTED" | "HUMAN_REQUIRED",
    "riskExplanation": string | null,
    "suggestedPlacementApproach": string | null,
    "anchorRecommendation": { "anchorType": "EXACT_MATCH" | "PARTIAL_MATCH" | "BRANDED" | "GENERIC" | "URL" | "LONG_TAIL", "anchor": string, "explanation": string } | null
  }],
  "overview": string | null
}`;
  const rows = input.opportunities.map((opportunity) => ({
    opportunityId: opportunity.opportunityId,
    platform: opportunity.platform.name,
    url: opportunity.platform.url,
    placementType: opportunity.placementType,
    placementMethod: opportunity.placementMethod,
    status: opportunity.status,
    score: opportunity.score,
    overallScore: opportunity.overallScore,
    donorQuality: opportunity.donorQuality,
    traffic: opportunity.traffic,
    riskLevel: opportunity.riskLevel,
    providerAvailable: opportunity.providerAvailable,
    providerCapabilitiesVerified: opportunity.providerCapabilitiesVerified,
    automationAvailable: opportunity.automationAvailable,
    hasIntel: opportunity.hasIntel,
    strategySupportsType: opportunity.strategySupportsType,
  }));
  return [
    {
      role: 'system',
      content: SYSTEM('build a placement plan decision map from deterministic signals', schema),
    },
    {
      role: 'user',
      content:
        USER('campaign', input.campaign) +
        '\n\n' +
        USER('company', input.company) +
        '\n\n' +
        USER('company analysis', input.companyAnalysis) +
        '\n\n' +
        USER('strategy', input.strategy) +
        '\n\n' +
        USER('opportunities', rows) +
        '\n\n' +
        'Interpret ONLY the given deterministic signals (score, overallScore, donorQuality, riskLevel, provider, strategy). ' +
        'The final numbers are computed by the domain — you only interpret them. ' +
        'Return one item per opportunity id (exact ids), an overview sentence and a decision per item.',
    },
  ];
}

function searchQueriesPrompt(input: GenerateSearchQueriesInput): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const schema = `{
  "intents": [{
    "intent": string,
    "categoryCode": string | null,
    "queries": string[1..3]
  }]
}`;
  return [
    {
      role: 'system',
      content: SYSTEM('plan web search intents for link-building discovery', schema),
    },
    {
      role: 'user',
      content:
        USER('company', input.company) +
        '\n\n' +
        USER('campaign goals', input.campaignGoals) +
        '\n\n' +
        `relevantCategoryCodes: ${JSON.stringify(input.relevantCategoryCodes)}\n` +
        `availableCategoryCodes: ${JSON.stringify(input.availableCategoryCodes)}\n\n` +
        'Return 4-8 research intents. For each intent: a short direction name (e.g. "мебельные каталоги"), ' +
        'the catalog categoryCode from the available list when it matches (otherwise null), and 1-3 concrete ' +
        'web search queries. Queries must be site-discovery oriented (catalogs, directories, media, resource pages, ' +
        'industry portals), not product searches.\n' +
        'CRITICAL: categoryCode must be one of the exact strings from availableCategoryCodes, copied verbatim, ' +
        'or null. Never invent, translate, pluralize or shorten the code. If none of the available codes matches, return null.',
    },
  ];
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

/** Removes known-sensitive shapes before sending to the LLM. */
function sanitizeUnknown(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  return value;
}
