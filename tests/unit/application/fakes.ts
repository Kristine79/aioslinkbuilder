import type {
  PlacementCategory,
  PlacementProvider,
  Platform,
  ProviderCapability,
} from '@aios/domain';
import type { PlacementProviderRegistry } from '@aios/application';
import type {
  AIAnchorRecommendation,
  AIDonorRisk,
  AILinkInsert,
  AINegotiationAnalysis,
  AIPageAnalysis,
  AIOutreachMessage,
  AIProvider,
  AnchorRecommendationInput,
  CompanyAnalysis,
  CompanyAnalysisInput,
  ContentDraft,
  ContentPreparationInput,
  DonorQualityEstimateInput,
  DonorQualityEstimates,
  DonorRiskInput,
  GenerateSearchQueriesInput,
  LinkInsertInput,
  NegotiationReplyInput,
  OpportunityClassification,
  OpportunityClassificationInput,
  OutreachInput,
  PageAnalysisInput,
  PlacementPlanDecisionMap,
  PlacementPlanInput,
  SearchQueryPlan,
} from '@aios/ai';
import type { PlacementProvider as PlacementProviderContract } from '@aios/integrations';

/**
 * In-memory repository fakes now live in @aios/infrastructure (shared with
 * the prototype demo and the API composition); this file re-exports them so
 * existing tests keep working and adds test-only helpers.
 */
export {
  InMemoryCompanyRepository,
  InMemoryCampaignRepository,
  InMemoryAuditLogRepository,
  InMemoryPlacementOpportunityRepository,
  InMemoryLookupRepository,
  InMemoryAIAnalysisRepository,
  InMemoryPlacementRepository,
  InMemoryVerificationRepository,
  InMemoryEvidenceRepository,
} from '@aios/infrastructure';

export class InMemoryPlacementProviderRegistry implements PlacementProviderRegistry {
  constructor(
    private readonly entities: PlacementProvider[],
    private readonly implementations = new Map<string, PlacementProviderContract>(),
  ) {}

  listByPlatformId(platformId: string): Promise<PlacementProvider[]> {
    return Promise.resolve(this.entities.filter((provider) => provider.platformId === platformId));
  }

  resolve(providerId: string): Promise<PlacementProviderContract> {
    const implementation = this.implementations.get(providerId);
    if (implementation === undefined) {
      return Promise.reject(new Error(`InMemory registry: provider "${providerId}" not bound`));
    }
    return Promise.resolve(implementation);
  }
}

export interface StubAIProviderState {
  companyAnalysis?: CompanyAnalysis;
  classification?: OpportunityClassification;
  placementPlan?: PlacementPlanDecisionMap;
  placementPlanError?: Error;
}

export class StubAIProvider implements AIProvider {
  readonly name = 'stub';
  readonly calls = {
    analyzeCompany: 0,
    classifyOpportunity: 0,
    prepareContent: 0,
    generatePlacementPlan: 0,
  };
  lastAnalyzeCompanyInput: CompanyAnalysisInput | null = null;
  lastPlacementPlanInput: PlacementPlanInput | null = null;

  constructor(private readonly state: StubAIProviderState = {}) {}

  /** Binds the decision map after construction (ids may be harness-specific). */
  setPlacementPlan(placementPlan: PlacementPlanDecisionMap): void {
    this.state.placementPlan = placementPlan;
    delete this.state.placementPlanError;
  }

  /** Forces the AI provider to fail for the next plan generation. */
  failPlacementPlan(error: Error): void {
    delete this.state.placementPlan;
    this.state.placementPlanError = error;
  }

  analyzeCompany(input: CompanyAnalysisInput): Promise<CompanyAnalysis> {
    this.calls.analyzeCompany += 1;
    this.lastAnalyzeCompanyInput = input;
    if (this.state.companyAnalysis === undefined) {
      return Promise.reject(new Error('StubAIProvider: companyAnalysis not configured'));
    }
    return Promise.resolve(this.state.companyAnalysis);
  }

  classifyOpportunity(_input: OpportunityClassificationInput): Promise<OpportunityClassification> {
    this.calls.classifyOpportunity += 1;
    if (this.state.classification === undefined) {
      return Promise.reject(new Error('StubAIProvider: classification not configured'));
    }
    return Promise.resolve(this.state.classification);
  }

  generatePlacementPlan(input: PlacementPlanInput): Promise<PlacementPlanDecisionMap> {
    this.calls.generatePlacementPlan += 1;
    this.lastPlacementPlanInput = input;
    if (this.state.placementPlanError !== undefined) {
      return Promise.reject(this.state.placementPlanError);
    }
    if (this.state.placementPlan === undefined) {
      return Promise.reject(new Error('StubAIProvider: placementPlan not configured'));
    }
    return Promise.resolve(this.state.placementPlan);
  }

  prepareContent(_input: ContentPreparationInput): Promise<ContentDraft> {
    this.calls.prepareContent += 1;
    return Promise.resolve({ content: 'Draft content' });
  }

  analyzePage(_input: PageAnalysisInput): Promise<AIPageAnalysis> {
    return Promise.resolve({
      targetPage: 'https://media.example/article',
      pageTitle: 'Article',
      pageType: 'EDITORIAL',
      topicalRelevance: 85,
      linkInsertSuitability: 80,
      indexation: 'INDEXED',
      suggestedPlacementLocation: 'middle',
      summary: 'Summary',
    });
  }

  generateLinkInsert(_input: LinkInsertInput): Promise<AILinkInsert> {
    return Promise.resolve({
      anchor: 'Ссылка на сайт',
      anchorAlternatives: ['Альтернатива 1', 'Альтернатива 2'],
      suggestedInsertionPoint: 'paragraph 2',
      text: 'Текст вставки',
      explanation: 'Естественный контекст',
      confidence: 75,
    });
  }

  recommendAnchor(_input: AnchorRecommendationInput): Promise<AIAnchorRecommendation> {
    return Promise.resolve({
      anchorType: 'BRANDED',
      anchor: 'Brand',
      alternatives: ['Brand alternative'],
      explanation: 'Брендированный анкор',
      confidence: 70,
    });
  }

  generateOutreach(_input: OutreachInput): Promise<AIOutreachMessage> {
    return Promise.resolve({
      subject: 'Предложение',
      message: 'Полное сообщение',
      shortVersion: 'Короткая версия',
      opening: 'Приветствие',
      valueProposition: 'Ценность',
      placementRequest: 'Запрос',
      cta: 'Призыв к действию',
    });
  }

  analyzeNegotiationReply(_input: NegotiationReplyInput): Promise<AINegotiationAnalysis> {
    return Promise.resolve({
      intent: 'PRICE_NEGOTIATION',
      suggestedResponse: 'Ответ',
      strategy: 'Стратегия',
      recommendedPrice: { min: 100, max: 150, currency: 'USD' },
      fallbackOption: 'Запасной вариант',
      risks: ['Риск'],
      confidence: 70,
    });
  }

  estimateDonorQuality(_input: DonorQualityEstimateInput): Promise<DonorQualityEstimates> {
    return Promise.resolve({
      topicalRelevance: 80,
      audienceMatch: 75,
      geographicRelevance: 70,
      placementQuality: 74,
      automationPotential: 60,
      overallAssessment: 'Оценка',
    });
  }

  assessDonorRisk(_input: DonorRiskInput): Promise<AIDonorRisk> {
    return Promise.resolve({ level: 'LOW', reasons: [] });
  }

  generateSearchQueries(input: GenerateSearchQueriesInput): Promise<SearchQueryPlan> {
    return Promise.resolve({
      intents: input.availableCategoryCodes.slice(0, 2).map((code) => ({
        intent: `Площадки по категории ${code}`,
        categoryCode: code,
        queries: [`${input.company.name} ${code} справочник`],
      })),
    });
  }
}

export function seedCategories(): PlacementCategory[] {
  return [
    {
      id: 'cat-1',
      code: 'WEB_DIRECTORIES',
      name: 'Web directories',
      description: null,
      sortOrder: 1,
    },
    {
      id: 'cat-2',
      code: 'INDUSTRY_MEDIA',
      name: 'Industry media',
      description: null,
      sortOrder: 2,
    },
  ];
}

export function seedPlatforms(): Platform[] {
  return [
    {
      id: 'platform-1',
      name: 'Catalog A',
      url: 'https://catalog-a.example',
      country: 'DE',
      categoryId: 'cat-1',
      notes: null,
      metadata: { pages: ['/en', '/de'] },
    },
    {
      id: 'platform-2',
      name: 'Media B',
      url: 'https://media-b.example',
      country: null,
      categoryId: 'cat-2',
      notes: null,
      metadata: null,
    },
  ];
}

export function seedProviders(): PlacementProvider[] {
  const capabilities: readonly ProviderCapability[] = [
    'DISCOVER',
    'VALIDATE',
    'CREATE',
    'GET_STATUS',
    'VERIFY',
  ];
  return [
    {
      id: 'provider-1',
      platformId: 'platform-1',
      name: 'Catalog A Mock',
      providerType: 'MOCK',
      capabilities: [...capabilities],
      capabilitiesVerified: true,
      notes: null,
    },
    {
      id: 'provider-2',
      platformId: 'platform-2',
      name: 'Media B Manual',
      providerType: 'MANUAL',
      capabilities: ['VERIFY'],
      capabilitiesVerified: true,
      notes: null,
    },
  ];
}
