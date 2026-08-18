import { randomUUID } from 'node:crypto';

import type {
  AIAnalysis,
  Campaign,
  CampaignDraft,
  Company,
  CompanyDraft,
  OpportunityDraft,
  PlacementCategory,
  PlacementOpportunity,
  Platform,
  PlacementProvider,
} from '@aios/domain';
import type {
  AIAnalysisDraft,
  AIAnalysisRepository,
  AuditLogDraft,
  AuditLogRepository,
  CampaignRepository,
  CompanyRepository,
  LookupRepository,
  PlacementOpportunityRepository,
} from '@aios/application';
import type {
  AIProvider,
  CompanyAnalysis,
  CompanyAnalysisInput,
  ContentDraft,
  ContentPreparationInput,
  OpportunityClassification,
  OpportunityClassificationInput,
} from '@aios/ai';

export class InMemoryCompanyRepository implements CompanyRepository {
  readonly companies = new Map<string, Company>();

  findById(id: string): Promise<Company | null> {
    return Promise.resolve(this.companies.get(id) ?? null);
  }

  create(draft: CompanyDraft): Promise<Company> {
    const now = new Date();
    const company: Company = {
      id: randomUUID(),
      name: draft.name,
      description: draft.description ?? null,
      industry: draft.industry ?? null,
      geography: draft.geography ?? [],
      locations: draft.locations ?? [],
      products: draft.products ?? [],
      targetAudience: draft.targetAudience ?? [],
      website: draft.website ?? null,
      metadata: null,
      createdAt: now,
      updatedAt: now,
    };
    this.companies.set(company.id, company);
    return Promise.resolve(company);
  }

  update(company: Company): Promise<Company> {
    this.companies.set(company.id, company);
    return Promise.resolve(company);
  }
}

export class InMemoryCampaignRepository implements CampaignRepository {
  readonly campaigns = new Map<string, Campaign>();

  findById(id: string): Promise<Campaign | null> {
    return Promise.resolve(this.campaigns.get(id) ?? null);
  }

  findByCompanyId(companyId: string): Promise<Campaign[]> {
    return Promise.resolve(
      [...this.campaigns.values()].filter((campaign) => campaign.companyId === companyId),
    );
  }

  create(draft: CampaignDraft): Promise<Campaign> {
    const now = new Date();
    const campaign: Campaign = {
      id: randomUUID(),
      companyId: draft.companyId,
      name: draft.name,
      goals: draft.goals,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    };
    this.campaigns.set(campaign.id, campaign);
    return Promise.resolve(campaign);
  }

  update(campaign: Campaign): Promise<Campaign> {
    this.campaigns.set(campaign.id, campaign);
    return Promise.resolve(campaign);
  }
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  readonly entries: AuditLogDraft[] = [];

  append(draft: AuditLogDraft): Promise<void> {
    this.entries.push(draft);
    return Promise.resolve();
  }
}

export class InMemoryPlacementOpportunityRepository implements PlacementOpportunityRepository {
  readonly opportunities = new Map<string, PlacementOpportunity>();

  findById(id: string): Promise<PlacementOpportunity | null> {
    return Promise.resolve(this.opportunities.get(id) ?? null);
  }

  findByCampaignId(campaignId: string): Promise<PlacementOpportunity[]> {
    return Promise.resolve(
      [...this.opportunities.values()].filter(
        (opportunity) => opportunity.campaignId === campaignId,
      ),
    );
  }

  findByCampaignIdAndPlatformId(
    campaignId: string,
    platformId: string,
  ): Promise<PlacementOpportunity | null> {
    const match = [...this.opportunities.values()].find(
      (opportunity) =>
        opportunity.campaignId === campaignId && opportunity.platformId === platformId,
    );
    return Promise.resolve(match ?? null);
  }

  create(draft: OpportunityDraft): Promise<PlacementOpportunity> {
    const now = new Date();
    const opportunity: PlacementOpportunity = {
      id: randomUUID(),
      campaignId: draft.campaignId,
      platformId: draft.platformId,
      categoryId: null,
      placementType: draft.placementType,
      relevance: null,
      score: null,
      scoreBreakdown: null,
      recommendation: null,
      whyRecommended: null,
      placementMethod: draft.placementMethod,
      providerCapabilities: [],
      status: 'DISCOVERED',
      metadata: null,
      createdAt: now,
      updatedAt: now,
    };
    this.opportunities.set(opportunity.id, opportunity);
    return Promise.resolve(opportunity);
  }

  update(opportunity: PlacementOpportunity): Promise<PlacementOpportunity> {
    this.opportunities.set(opportunity.id, opportunity);
    return Promise.resolve(opportunity);
  }
}

export class InMemoryLookupRepository implements LookupRepository {
  categories: PlacementCategory[] = [];
  platforms: Platform[] = [];
  providers: PlacementProvider[] = [];

  listCategories(): Promise<PlacementCategory[]> {
    return Promise.resolve(this.categories);
  }

  listPlatforms(): Promise<Platform[]> {
    return Promise.resolve(this.platforms);
  }

  listProviders(): Promise<PlacementProvider[]> {
    return Promise.resolve(this.providers);
  }
}

export class InMemoryAIAnalysisRepository implements AIAnalysisRepository {
  readonly analyses = new Map<string, AIAnalysis>();

  findByCampaignId(campaignId: string): Promise<AIAnalysis[]> {
    return Promise.resolve(
      [...this.analyses.values()].filter((analysis) => analysis.campaignId === campaignId),
    );
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

export interface StubAIProviderState {
  companyAnalysis?: CompanyAnalysis;
  classification?: OpportunityClassification;
}

export class StubAIProvider implements AIProvider {
  readonly name = 'stub';
  readonly calls = {
    analyzeCompany: 0,
    classifyOpportunity: 0,
    prepareContent: 0,
  };

  constructor(private readonly state: StubAIProviderState = {}) {}

  analyzeCompany(_input: CompanyAnalysisInput): Promise<CompanyAnalysis> {
    this.calls.analyzeCompany += 1;
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

  prepareContent(_input: ContentPreparationInput): Promise<ContentDraft> {
    this.calls.prepareContent += 1;
    return Promise.resolve({ content: 'Draft content' });
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
