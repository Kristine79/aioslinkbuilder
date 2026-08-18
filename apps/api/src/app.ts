/**
 * HTTP delivery layer: routes, request parsing and error mapping only.
 * All state changes go through application use cases; the domain state
 * machine remains the source of truth. No business logic lives here.
 *
 * Campaign context: every campaign-scoped route resolves the campaign from
 * the optional `campaignId` query parameter and falls back to the default
 * (seeded) campaign, so the product supports multiple companies/campaigns
 * while staying fully backward compatible.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';

import {
  AnalyzeCompanyUseCase,
  ApproveOpportunityUseCase,
  CatalogPlatformDiscoverySource,
  ClassifyOpportunityUseCase,
  CompleteManualPlacementUseCase,
  CreateCampaignUseCase,
  CreateCompanyUseCase,
  DiscoverOpportunitiesUseCase,
  ExecutePlacementUseCase,
  GeneratePlacementStrategyUseCase,
  ListCampaignsByCompanyUseCase,
  MonitorPlacementUseCase,
  NoCompanyAnalysisError,
  NoProviderAssignedError,
  NoProviderAvailableError,
  NotFoundError,
  RequestManualPlacementUseCase,
  SearchPlatformDiscoverySource,
  VerifyPlacementUseCase,
} from '@aios/application';
import type {
  Company,
  Campaign,
  PlacementOpportunity,
  PlacementProvider,
  Verification,
  Evidence,
} from '@aios/domain';
import { ValidationError, InvalidPlacementTransitionError } from '@aios/domain';
import { ProviderError } from '@aios/integrations';

import {
  buildLookupMaps,
  mapAuditEvent,
  mapCompany,
  mapOpportunity,
  mapVerification,
  type ApiActivityDto,
  type ApiCampaignListItemDto,
  type ApiCategoryDto,
  type ApiCompanyListItemDto,
  type ApiOverviewDto,
  type ApiStrategyItemDto,
} from './dto.js';
import type { NordhausEnvironment } from './scenario/nordhaus-environment.js';
import {
  NORDHAUS_CATEGORIES,
  NORDHAUS_CORE_PLATFORM_IDS,
  NORDHAUS_SEARCH_PLATFORM_IDS,
} from './scenario/nordhaus-fixtures.js';

export interface ApiServices {
  env: NordhausEnvironment;
  /** Default campaign used when the caller does not pass ?campaignId=. */
  campaign: Campaign;
}

/** Maps domain/application/provider errors to HTTP statuses. */
function httpError(error: unknown): {
  status: 400 | 404 | 409 | 422 | 500 | 502;
  code: string;
  message: string;
} {
  if (error instanceof NotFoundError) {
    return { status: 404, code: 'NOT_FOUND', message: error.message };
  }
  if (error instanceof InvalidPlacementTransitionError) {
    return { status: 409, code: 'INVALID_STATE', message: error.message };
  }
  if (error instanceof ValidationError) {
    return { status: 400, code: 'VALIDATION', message: error.message };
  }
  if (error instanceof NoCompanyAnalysisError) {
    return { status: 409, code: 'NO_ANALYSIS', message: error.message };
  }
  if (error instanceof NoProviderAvailableError || error instanceof NoProviderAssignedError) {
    return { status: 422, code: 'NO_PROVIDER', message: error.message };
  }
  if (error instanceof ProviderError) {
    return { status: 502, code: 'PROVIDER_ERROR', message: error.message };
  }
  if (error instanceof Error) {
    return { status: 500, code: 'INTERNAL', message: error.message };
  }
  return { status: 500, code: 'INTERNAL', message: 'Unknown error' };
}

export function createApiApp(services: ApiServices): Hono {
  const env = services.env;
  const app = new Hono();

  const analyze = new AnalyzeCompanyUseCase(
    env.campaigns,
    env.companies,
    env.ai,
    env.analyses,
    env.auditLog,
  );
  const approve = new ApproveOpportunityUseCase(env.opportunities, env.auditLog);
  const execute = new ExecutePlacementUseCase(
    env.opportunities,
    env.placements,
    env.campaigns,
    env.companies,
    env.registry,
    env.auditLog,
  );
  const monitor = new MonitorPlacementUseCase(env.placements, env.registry, env.auditLog);
  const verify = new VerifyPlacementUseCase(
    env.placements,
    env.opportunities,
    env.campaigns,
    env.companies,
    env.registry,
    env.verifications,
    env.evidence,
    env.auditLog,
  );
  const requestManual = new RequestManualPlacementUseCase(
    env.opportunities,
    env.placements,
    env.registry,
    env.auditLog,
  );
  const completeManual = new CompleteManualPlacementUseCase(env.placements, env.auditLog);
  const strategy = new GeneratePlacementStrategyUseCase(
    env.campaigns,
    env.companies,
    env.analyses,
    env.lookups,
  );
  const createCompany = new CreateCompanyUseCase(env.companies, env.auditLog);
  const createCampaign = new CreateCampaignUseCase(env.companies, env.campaigns, env.auditLog);
  const listCampaigns = new ListCampaignsByCompanyUseCase(env.campaigns);
  const discover = new DiscoverOpportunitiesUseCase(
    env.campaigns,
    env.companies,
    env.lookups,
    env.opportunities,
    env.auditLog,
    buildDiscoverySources(env),
  );
  const classify = new ClassifyOpportunityUseCase(
    env.ai,
    env.opportunities,
    env.analyses,
    env.lookups,
    env.registry,
    env.auditLog,
  );

  /** Resolves the campaign from ?campaignId= with a default fallback. */
  const resolveCampaign = async (c: Context): Promise<Campaign> => {
    const id = c.req.query('campaignId');
    if (id === undefined || id === '' || id === services.campaign.id) {
      return services.campaign;
    }
    const campaign = await env.campaigns.findById(id);
    if (campaign === null) {
      throw new NotFoundError('Campaign', id);
    }
    return campaign;
  };

  app.get('/api/meta', async (c) => {
    const categories: ApiCategoryDto[] = (await env.lookups.listCategories()).map((category) => ({
      id: category.id,
      code: category.code,
      name: category.name,
    }));
    return c.json({ categories });
  });

  app.post('/api/companies', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown;
    if (body === null || typeof body !== 'object') {
      throw new ValidationError('company payload is required');
    }
    const record = body as {
      name?: unknown;
      website?: unknown;
      industry?: unknown;
      description?: unknown;
      geography?: unknown;
      locations?: unknown;
      products?: unknown;
      targetAudience?: unknown;
    };
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (name === '') {
      throw new ValidationError('name is required');
    }
    const company = await createCompany.execute({
      name,
      ...(typeof record.website === 'string' && record.website.trim() !== ''
        ? { website: record.website.trim() }
        : {}),
      ...(typeof record.industry === 'string' && record.industry.trim() !== ''
        ? { industry: record.industry.trim() }
        : {}),
      ...(typeof record.description === 'string' && record.description.trim() !== ''
        ? { description: record.description.trim() }
        : {}),
      geography: stringList(record.geography),
      locations: stringList(record.locations),
      products: stringList(record.products),
      targetAudience: stringList(record.targetAudience),
    });
    return c.json(mapCompany(company, null), 201);
  });

  app.get('/api/companies', async (c) => {
    const companies = await env.companies.all();
    const items: ApiCompanyListItemDto[] = [];
    for (const company of companies) {
      const campaigns = await listCampaigns.execute(company.id);
      items.push({
        id: company.id,
        name: company.name,
        industry: company.industry,
        website: company.website,
        description: company.description,
        createdAt: company.createdAt.toISOString(),
        campaigns: campaigns.map(mapCampaignListItem),
      });
    }
    return c.json({ items });
  });

  app.post('/api/companies/:id/campaigns', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown;
    if (body === null || typeof body !== 'object') {
      throw new ValidationError('campaign payload is required');
    }
    const record = body as { name?: unknown; goals?: unknown };
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (name === '') {
      throw new ValidationError('name is required');
    }
    const campaign = await createCampaign.execute({
      companyId: c.req.param('id'),
      name,
      goals: stringList(record.goals),
    });
    return c.json(mapCampaignListItem(campaign), 201);
  });

  app.get('/api/campaigns', async (c) => {
    const companyId = c.req.query('companyId');
    if (companyId === undefined || companyId === '') {
      return c.json({ items: [] });
    }
    const campaigns = await listCampaigns.execute(companyId);
    return c.json({ items: campaigns.map(mapCampaignListItem) });
  });

  app.get('/api/company', async (c) => {
    const campaign = await resolveCampaign(c);
    const company = await requiredCompany(campaign, env);
    const analysis = await env.analyses.findLatestValidCompanyAnalysis(campaign.id);
    return c.json(mapCompany(company, analysis));
  });

  app.post('/api/company/analyze', async (c) => {
    const campaign = await resolveCampaign(c);
    await analyze.execute({ campaignId: campaign.id });
    const company = await requiredCompany(campaign, env);
    const analysis = await env.analyses.findLatestValidCompanyAnalysis(campaign.id);
    return c.json(mapCompany(company, analysis), 200);
  });

  app.get('/api/strategy', async (c) => {
    const campaign = await resolveCampaign(c);
    const result = await strategy.execute({ campaignId: campaign.id });
    const categories = await env.lookups.listCategories();
    const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
    const opportunities = await env.opportunities.findByCampaignId(campaign.id);
    const countByCategoryId = new Map<string, number>();
    for (const opportunity of opportunities) {
      if (opportunity.categoryId === null) continue;
      countByCategoryId.set(
        opportunity.categoryId,
        (countByCategoryId.get(opportunity.categoryId) ?? 0) + 1,
      );
    }
    const items: ApiStrategyItemDto[] = result.items.map((item) => ({
      categoryId: item.categoryId,
      categoryCode: item.categoryCode,
      categoryName: categoryNameById.get(item.categoryId) ?? item.categoryName,
      placementType: item.placementType,
      opportunityCount: countByCategoryId.get(item.categoryId) ?? 0,
    }));
    return c.json({ items });
  });

  app.get('/api/opportunities', async (c) => {
    const campaign = await resolveCampaign(c);
    const opportunities = await env.opportunities.findByCampaignId(campaign.id);
    const context = await opportunityContext(env);
    const all = await Promise.all(
      opportunities.map((opportunity) => mapOpportunityWithRelations(env, opportunity, context)),
    );

    const category = c.req.query('category');
    const method = c.req.query('method');
    const status = c.req.query('status');
    const source = c.req.query('source');
    const minScoreRaw = c.req.query('minScore');

    let filtered = all;
    if (category !== undefined && category !== 'all') {
      filtered = filtered.filter((item) => item.categoryCode === category);
    }
    if (method !== undefined && method !== 'all') {
      filtered = filtered.filter((item) => item.placementMethod === method);
    }
    if (status !== undefined && status !== 'all') {
      filtered = filtered.filter((item) => item.status === status);
    }
    if (source !== undefined && source !== 'all') {
      filtered = filtered.filter((item) => item.discoverySource === source);
    }
    if (minScoreRaw !== undefined && minScoreRaw !== '') {
      const minScore = Number(minScoreRaw);
      if (Number.isFinite(minScore)) {
        filtered = filtered.filter((item) => (item.score ?? 0) >= minScore);
      }
    }

    const ranked = [...filtered].sort(
      (a, b) => (b.score ?? -1) - (a.score ?? -1) || a.platformName.localeCompare(b.platformName),
    );
    return c.json({ items: ranked });
  });

  app.get('/api/opportunities/:id', async (c) => {
    const opportunity = await env.opportunities.findById(c.req.param('id'));
    if (opportunity === null) {
      throw new NotFoundError('PlacementOpportunity', c.req.param('id'));
    }
    const context = await opportunityContext(env);
    return c.json(await mapOpportunityWithRelations(env, opportunity, context));
  });

  app.post('/api/opportunities/:id/approve', async (c) => {
    const result = await approve.execute({ opportunityId: c.req.param('id') });
    const context = await opportunityContext(env);
    return c.json(await mapOpportunityWithRelations(env, result, context), 200);
  });

  app.post('/api/opportunities/:id/execute', async (c) => {
    const result = await execute.execute({ opportunityId: c.req.param('id') });
    return c.json({ placementId: result.id, status: result.status }, 200);
  });

  app.post('/api/opportunities/:id/request-manual', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown;
    const reason =
      body !== null &&
      typeof body === 'object' &&
      typeof (body as { reason?: unknown }).reason === 'string'
        ? (body as { reason: string }).reason.trim()
        : '';
    if (reason === '') {
      throw new ValidationError('reason is required for a manual placement request');
    }
    const result = await requestManual.execute({
      opportunityId: c.req.param('id'),
      reason,
    });
    return c.json({ placementId: result.id, status: result.status }, 200);
  });

  app.post('/api/placements/:id/monitor', async (c) => {
    const result = await monitor.execute({ placementId: c.req.param('id') });
    return c.json({ placementId: result.id, status: result.status }, 200);
  });

  app.post('/api/placements/:id/verify', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown;
    const expectedBacklink =
      body !== null &&
      typeof body === 'object' &&
      typeof (body as { expectedBacklink?: unknown }).expectedBacklink === 'string'
        ? (body as { expectedBacklink: string }).expectedBacklink
        : null;
    const result = await verify.execute({
      placementId: c.req.param('id'),
      expectedBacklink,
    });
    return c.json(
      {
        placementId: result.placement.id,
        status: result.placement.status,
        verification: mapVerification(result.verification),
      },
      200,
    );
  });

  app.post('/api/placements/:id/complete-manual', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown;
    const record =
      body !== null && typeof body === 'object'
        ? (body as { externalId?: unknown; liveUrl?: unknown; notes?: unknown })
        : {};
    const externalId = typeof record.externalId === 'string' ? record.externalId.trim() : '';
    const liveUrl = typeof record.liveUrl === 'string' ? record.liveUrl.trim() : '';
    if (externalId === '') {
      throw new ValidationError('externalId is required to complete a manual placement');
    }
    if (liveUrl === '') {
      throw new ValidationError('liveUrl is required to complete a manual placement');
    }
    const result = await completeManual.execute({
      placementId: c.req.param('id'),
      externalId,
      liveUrl,
      ...(typeof record.notes === 'string' && record.notes.trim() !== ''
        ? { notes: record.notes }
        : {}),
    });
    return c.json({ placementId: result.id, status: result.status }, 200);
  });

  /**
   * Runs the full discovery pipeline for the campaign: discovery sources
   * (catalog + search) → new opportunities → AI classification → scoring.
   * Returns the newly discovered opportunities with their classification.
   */
  app.post('/api/discover', async (c) => {
    const campaign = await resolveCampaign(c);
    const analysis = await env.analyses.findLatestValidCompanyAnalysis(campaign.id);
    if (analysis === null) {
      throw new NoCompanyAnalysisError(campaign.id);
    }
    const output = analysis.structuredOutput as { relevantCategories?: unknown };
    const categoryCodes = Array.isArray(output.relevantCategories)
      ? output.relevantCategories.filter(
          (entry): entry is string => typeof entry === 'string' && entry.trim() !== '',
        )
      : [];

    const discovered = await discover.execute({
      campaignId: campaign.id,
      placementType: 'BUSINESS_PROFILE',
      categoryCodes,
    });

    const classified: PlacementOpportunity[] = [];
    for (const opportunity of discovered) {
      classified.push(await classify.execute({ opportunityId: opportunity.id }));
    }

    const context = await opportunityContext(env);
    const items = await Promise.all(
      classified.map((opportunity) => mapOpportunityWithRelations(env, opportunity, context)),
    );
    const sources = [...new Set(classified.map((opportunity) => sourceOf(opportunity)))];
    return c.json({
      discovered: discovered.length,
      classified: classified.length,
      sources,
      items,
    });
  });

  app.get('/api/overview', async (c) => {
    const campaign = await resolveCampaign(c);
    const company = await requiredCompany(campaign, env);
    const opportunities = await env.opportunities.findByCampaignId(campaign.id);
    const context = await opportunityContext(env);
    const mapped = await Promise.all(
      opportunities.map((opportunity) => mapOpportunityWithRelations(env, opportunity, context)),
    );

    const placements = mapped.flatMap((item) => item.placements);
    const byStatus = new Map<string, number>();
    for (const placement of placements) {
      byStatus.set(placement.status, (byStatus.get(placement.status) ?? 0) + 1);
    }

    const counts = {
      opportunities: mapped.length,
      recommended: mapped.filter((item) => item.status === 'QUALIFIED').length,
      approved: mapped.filter(
        (item) =>
          item.status === 'SELECTED' || item.status === 'READY' || item.status === 'NEEDS_MANUAL',
      ).length,
      ready: mapped.filter((item) => item.status === 'READY').length,
      executed: mapped.filter((item) => item.placements.length > 0).length,
      published: mapped.filter((item) =>
        item.placements.some((p) => p.status === 'PUBLISHED' || p.status === 'VERIFIED'),
      ).length,
      verified: mapped.filter((item) => item.placements.some((p) => p.status === 'VERIFIED'))
        .length,
      failed: placements.filter((p) => p.status === 'FAILED').length,
      manual: placements.filter((p) => p.status === 'NEEDS_MANUAL').length,
    };

    const funnel = [
      { stage: 'discovered', count: counts.opportunities },
      { stage: 'recommended', count: counts.recommended },
      { stage: 'approved', count: counts.approved },
      { stage: 'executed', count: counts.executed },
      { stage: 'published', count: counts.published },
      { stage: 'verified', count: counts.verified },
    ];

    const manualActions = mapped
      .flatMap((item) =>
        item.placements
          .filter((placement) => placement.status === 'NEEDS_MANUAL')
          .map((placement) => ({
            placementId: placement.id,
            opportunityId: item.id,
            platformId: item.platformId,
            platformName: item.platformName,
            reason: placement.manual?.reason ?? '',
          })),
      )
      .filter((action) => action.reason !== '');

    const recentActivity = [...env.auditLog.entries]
      .filter((entry) => campaignScopeIds(campaign, mapped).has(entry.entityId))
      .slice(-10)
      .map((entry) => mapAuditEvent(entry))
      .reverse();

    const overview: ApiOverviewDto = {
      company: {
        id: company.id,
        name: company.name,
        industry: company.industry,
        website: company.website,
      },
      campaign: {
        id: campaign.id,
        name: campaign.name,
        goals: [...campaign.goals],
        status: campaign.status,
      },
      counts,
      totalPlacements: placements.length,
      funnel,
      manualActions,
      recentActivity,
    };
    return c.json(overview);
  });

  app.get('/api/activity', async (c) => {
    const campaign = await resolveCampaign(c);
    const opportunities = await env.opportunities.findByCampaignId(campaign.id);
    const context = await opportunityContext(env);
    const mapped = await Promise.all(
      opportunities.map((opportunity) => mapOpportunityWithRelations(env, opportunity, context)),
    );

    const verifications: ApiActivityDto['verifications'] = [];
    for (const item of mapped) {
      for (const placement of item.placements) {
        if (placement.verification === null) continue;
        verifications.push({
          id: placement.verification.id,
          placementId: placement.id,
          platformName: item.platformName,
          platformUrl: item.platformUrl,
          placementStatus: placement.status,
          verificationStatus: placement.verification.status,
          checkedAt: placement.verification.checkedAt,
          result: placement.verification.result,
          failureReason: placement.verification.failureReason,
          evidence: placement.evidence,
        });
      }
    }

    const audit = [...env.auditLog.entries]
      .filter((entry) => campaignScopeIds(campaign, mapped).has(entry.entityId))
      .map((entry) => mapAuditEvent(entry))
      .reverse();

    return c.json({ verifications, audit });
  });

  app.notFound((c) => {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404);
  });
  app.onError((error, c) => {
    const mapped = httpError(error);
    return c.json({ error: { code: mapped.code, message: mapped.message } }, mapped.status);
  });

  return app;
}

/** The discovery sources shared by the scenario seed and the /api/discover route. */
export function buildDiscoverySources(env: NordhausEnvironment) {
  const searchPlatforms = env.lookups.platforms.filter((platform) =>
    NORDHAUS_SEARCH_PLATFORM_IDS.includes(platform.id),
  );
  return [
    new CatalogPlatformDiscoverySource(env.lookups, NORDHAUS_CORE_PLATFORM_IDS),
    new SearchPlatformDiscoverySource(searchPlatforms, NORDHAUS_CATEGORIES),
  ];
}

async function requiredCompany(campaign: Campaign, env: NordhausEnvironment): Promise<Company> {
  const company = await env.companies.findById(campaign.companyId);
  if (company === null) {
    throw new NotFoundError('Company', campaign.companyId);
  }
  return company;
}

// --- small helpers (kept local to the delivery layer) -----------------------

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    : [];
}

function sourceOf(opportunity: PlacementOpportunity): string {
  const metadata = opportunity.metadata ?? {};
  return typeof metadata.discoverySource === 'string' ? metadata.discoverySource : 'unknown';
}

function mapCampaignListItem(campaign: Campaign): ApiCampaignListItemDto {
  return {
    id: campaign.id,
    companyId: campaign.companyId,
    name: campaign.name,
    goals: [...campaign.goals],
    status: campaign.status,
    createdAt: campaign.createdAt.toISOString(),
  };
}

/**
 * Entity ids whose audit events belong to a campaign: the campaign itself,
 * its opportunities and their placement attempts.
 */
function campaignScopeIds(
  campaign: Campaign,
  mapped: readonly ReturnType<typeof mapOpportunity>[],
): Set<string> {
  const ids = new Set<string>([campaign.id]);
  for (const item of mapped) {
    ids.add(item.id);
    for (const placement of item.placements) {
      ids.add(placement.id);
    }
  }
  return ids;
}

interface OpportunityContext {
  maps: ReturnType<typeof buildLookupMaps>;
  envProviders: readonly PlacementProvider[];
}

async function opportunityContext(env: NordhausEnvironment): Promise<OpportunityContext> {
  const [categories, platforms, providers] = await Promise.all([
    env.lookups.listCategories(),
    env.lookups.listPlatforms(),
    env.lookups.listProviders(),
  ]);
  return { maps: buildLookupMaps(platforms, categories, providers), envProviders: providers };
}

async function mapOpportunityWithRelations(
  env: NordhausEnvironment,
  opportunity: PlacementOpportunity,
  context: OpportunityContext,
): Promise<ReturnType<typeof mapOpportunity>> {
  const placements = await env.placements.findByOpportunityId(opportunity.id);
  const verificationsByPlacement = new Map<string, readonly Verification[]>();
  const evidenceByVerification = new Map<string, readonly Evidence[]>();
  for (const placement of placements) {
    const verifications = await env.verifications.findByPlacementId(placement.id);
    verificationsByPlacement.set(placement.id, verifications);
    for (const verification of verifications) {
      evidenceByVerification.set(
        verification.id,
        await env.evidence.findByVerificationId(verification.id),
      );
    }
  }
  return mapOpportunity(
    opportunity,
    placements,
    verificationsByPlacement,
    evidenceByVerification,
    context,
  );
}
