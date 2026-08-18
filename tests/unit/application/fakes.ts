import type {
  PlacementCategory,
  PlacementProvider,
  Platform,
  ProviderCapability,
} from '@aios/domain';
import type { PlacementProviderRegistry } from '@aios/application';
import type {
  AIProvider,
  CompanyAnalysis,
  CompanyAnalysisInput,
  ContentDraft,
  ContentPreparationInput,
  OpportunityClassification,
  OpportunityClassificationInput,
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
}

export class StubAIProvider implements AIProvider {
  readonly name = 'stub';
  readonly calls = {
    analyzeCompany: 0,
    classifyOpportunity: 0,
    prepareContent: 0,
  };
  lastAnalyzeCompanyInput: CompanyAnalysisInput | null = null;

  constructor(private readonly state: StubAIProviderState = {}) {}

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
