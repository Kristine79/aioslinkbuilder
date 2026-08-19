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
  AnalyzeNegotiationReplyUseCase,
  ApproveOpportunityUseCase,
  AssessOpportunityUseCase,
  CatalogPlatformDiscoverySource,
  ClassifyOpportunityUseCase,
  CompleteManualPlacementUseCase,
  CreateCampaignUseCase,
  CreateCompanyUseCase,
  DiscoverOpportunitiesUseCase,
  ExecutePlacementUseCase,
  GenerateLinkInsertUseCase,
  GenerateOutreachUseCase,
  GeneratePlacementStrategyUseCase,
  ListCampaignsByCompanyUseCase,
  MonitorPlacementUseCase,
  NoCompanyAnalysisError,
  NoProviderAssignedError,
  NoProviderAvailableError,
  NotFoundError,
  RecommendAnchorUseCase,
  RequestManualPlacementUseCase,
  RespondNegotiationUseCase,
  SearchPlatformDiscoverySource,
  UpdateOutreachStatusUseCase,
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
  const assess = new AssessOpportunityUseCase(
    env.opportunities,
    env.campaigns,
    env.companies,
    env.lookups,
    env.analyses,
    env.ai,
    env.seoMetrics,
    env.pageAnalysis,
    env.auditLog,
  );
  const linkInsert = new GenerateLinkInsertUseCase(
    env.opportunities,
    env.campaigns,
    env.companies,
    env.lookups,
    env.analyses,
    env.ai,
    env.auditLog,
  );
  const recommendAnchor = new RecommendAnchorUseCase(
    env.opportunities,
    env.campaigns,
    env.companies,
    env.lookups,
    env.analyses,
    env.ai,
    env.auditLog,
  );
  const generateOutreach = new GenerateOutreachUseCase(
    env.opportunities,
    env.campaigns,
    env.companies,
    env.lookups,
    env.analyses,
    env.ai,
    env.auditLog,
  );
  const updateOutreach = new UpdateOutreachStatusUseCase(
    env.opportunities,
    env.campaigns,
    env.companies,
    env.lookups,
    env.outreach,
    env.auditLog,
  );
  const analyzeNegotiation = new AnalyzeNegotiationReplyUseCase(
    env.opportunities,
    env.campaigns,
    env.companies,
    env.lookups,
    env.analyses,
    env.ai,
    env.auditLog,
  );
  const respondNegotiation = new RespondNegotiationUseCase(
    env.opportunities,
    env.campaigns,
    env.companies,
    env.lookups,
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
    const placementType = c.req.query('placementType');
    const risk = c.req.query('risk');
    const sort = c.req.query('sort') ?? 'score';
    const donorQualityMinRaw = c.req.query('donorQuality');
    const minTrafficRaw = c.req.query('minTraffic');

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
    if (placementType !== undefined && placementType !== 'all') {
      filtered = filtered.filter((item) => item.placementType === placementType);
    }
    if (risk !== undefined && risk !== 'all') {
      filtered = filtered.filter((item) => item.risk?.level === risk);
    }
    if (minScoreRaw !== undefined && minScoreRaw !== '') {
      const minScore = Number(minScoreRaw);
      if (Number.isFinite(minScore)) {
        filtered = filtered.filter((item) => (item.score ?? 0) >= minScore);
      }
    }
    if (donorQualityMinRaw !== undefined && donorQualityMinRaw !== '') {
      const minDq = Number(donorQualityMinRaw);
      if (Number.isFinite(minDq)) {
        filtered = filtered.filter((item) => (item.donorQualityScore ?? 0) >= minDq);
      }
    }
    if (minTrafficRaw !== undefined && minTrafficRaw !== '') {
      const minTraffic = Number(minTrafficRaw);
      if (Number.isFinite(minTraffic)) {
        filtered = filtered.filter((item) => (item.traffic ?? 0) >= minTraffic);
      }
    }

    const ranked = sortOpportunities(filtered, sort);
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

  /** Assesses the opportunity: donor quality, page analysis, risk, Score 2.0. */
  app.post('/api/opportunities/:id/intel', async (c) => {
    const result = await assess.execute({ opportunityId: c.req.param('id') });
    const context = await opportunityContext(env);
    return c.json(await mapOpportunityWithRelations(env, result, context), 200);
  });

  /**
   * Link insert assistant + anchor strategy for LINK_INSERT opportunities.
   * Runs the AI page-aware content generation and stores the result.
   */
  app.post('/api/opportunities/:id/link-insert', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown;
    const desiredAnchor =
      body !== null &&
      typeof body === 'object' &&
      typeof (body as { desiredAnchor?: unknown }).desiredAnchor === 'string'
        ? (body as { desiredAnchor: string }).desiredAnchor
        : undefined;
    await linkInsert.execute({
      opportunityId: c.req.param('id'),
      ...(desiredAnchor !== undefined && desiredAnchor.trim() !== ''
        ? { desiredAnchor }
        : {}),
    });
    const result = await recommendAnchor.execute({ opportunityId: c.req.param('id') });
    const context = await opportunityContext(env);
    return c.json(await mapOpportunityWithRelations(env, result, context), 200);
  });

  /** Generates the outreach draft (DRAFT) for the opportunity. */
  app.post('/api/opportunities/:id/outreach', async (c) => {
    const result = await generateOutreach.execute({ opportunityId: c.req.param('id') });
    const context = await opportunityContext(env);
    return c.json(await mapOpportunityWithRelations(env, result, context), 200);
  });

  /**
   * Human-in-the-loop outreach status transition (approve / send / …).
   * Sending is only ever triggered by an explicit human action.
   */
  app.post('/api/opportunities/:id/outreach/status', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown;
    const status =
      body !== null && typeof body === 'object' && typeof (body as { status?: unknown }).status === 'string'
        ? (body as { status: string }).status
        : '';
    const result = await updateOutreach.execute({
      opportunityId: c.req.param('id'),
      status: status as Parameters<typeof updateOutreach.execute>[0]['status'],
    });
    const context = await opportunityContext(env);
    return c.json(await mapOpportunityWithRelations(env, result, context), 200);
  });

  /** Negotiation copilot: paste a donor reply -> AI analysis. */
  app.post('/api/opportunities/:id/negotiation/analyze', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown;
    const reply =
      body !== null && typeof body === 'object' && typeof (body as { reply?: unknown }).reply === 'string'
        ? (body as { reply: string }).reply
        : '';
    const result = await analyzeNegotiation.execute({
      opportunityId: c.req.param('id'),
      reply,
    });
    const context = await opportunityContext(env);
    return c.json(await mapOpportunityWithRelations(env, result, context), 200);
  });

  /** Human approves/sends the AI-prepared negotiation response. */
  app.post('/api/opportunities/:id/negotiation/respond', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown;
    const record = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const agree = record.agree === true;
    const customResponse = typeof record.customResponse === 'string' ? record.customResponse : undefined;
    const result = await respondNegotiation.execute({
      opportunityId: c.req.param('id'),
      agree,
      ...(customResponse !== undefined ? { customResponse } : {}),
    });
    const context = await opportunityContext(env);
    return c.json(await mapOpportunityWithRelations(env, result, context), 200);
  });

  /**
   * Donor comparison: returns the requested opportunities plus a deterministic
   * recommendation that ranks them and explains why the top one is best.
   */
  app.post('/api/opportunities/compare', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown;
    const ids =
      body !== null && typeof body === 'object' && Array.isArray((body as { ids?: unknown }).ids)
        ? (body as { ids: unknown[] }).ids.filter((id): id is string => typeof id === 'string')
        : [];
    if (ids.length === 0) {
      throw new ValidationError('compare requires at least one opportunity id');
    }    const context = await opportunityContext(env);
    const rows: Array<ReturnType<typeof mapOpportunity>> = [];
    for (const id of ids) {
      const opportunity = await env.opportunities.findById(id);
      if (opportunity === null) {
        throw new NotFoundError('PlacementOpportunity', id);
      }
      rows.push(await mapOpportunityWithRelations(env, opportunity, context));
    }
    return c.json(buildComparison(rows));
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

    const humanActions = mapped.flatMap((item) => item.humanActions);
    const negotiations = mapped
      .filter((item) => item.negotiation !== null && item.negotiation.replies.length > 0)
      .map((item) => ({
        opportunityId: item.id,
        platformName: item.platformName,
        outreachStatus: item.outreach?.status ?? null,
        negotiationIntent: item.negotiation?.analysis?.intent ?? null,
      }));

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
      humanActions,
      negotiations,
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

type OpportunityRow = ReturnType<typeof mapOpportunity>;

const SORTERS: Readonly<Record<string, (a: OpportunityRow, b: OpportunityRow) => number>> = {
  score: (a, b) => (b.score ?? -1) - (a.score ?? -1) || a.platformName.localeCompare(b.platformName),
  donorQuality: (a, b) =>
    (b.donorQualityScore ?? -1) - (a.donorQualityScore ?? -1) || a.platformName.localeCompare(b.platformName),
  traffic: (a, b) =>
    (b.traffic ?? -1) - (a.traffic ?? -1) || a.platformName.localeCompare(b.platformName),
  relevance: (a, b) =>
    (b.scoreBreakdown?.topicalRelevance ?? -1) - (a.scoreBreakdown?.topicalRelevance ?? -1) ||
    a.platformName.localeCompare(b.platformName),
  lowestRisk: (a, b) => riskRank(a) - riskRank(b) || a.platformName.localeCompare(b.platformName),
  ease: (a, b) => easeRank(a) - easeRank(b) || a.platformName.localeCompare(b.platformName),
};

function riskRank(row: OpportunityRow): number {
  switch (row.risk?.level) {
    case 'LOW':
      return 0;
    case 'MEDIUM':
      return 1;
    case 'UNKNOWN':
      return 2;
    case 'HIGH':
      return 3;
    default:
      return 2;
  }
}

function easeRank(row: OpportunityRow): number {
  if (row.placementMethod === 'API') return 0;
  if (row.placementMethod === 'BROWSER') return 1;
  if (row.placementMethod === 'OUTREACH') return 2;
  if (row.placementMethod === 'MANUAL') return 3;
  return 4;
}

function sortOpportunities(items: OpportunityRow[], sort: string): OpportunityRow[] {
  const sorter = SORTERS[sort] ?? SORTERS.score;
  return [...items].sort(sorter);
}

interface ComparisonRow {
  id: string;
  platformName: string;
  platformUrl: string | null;
  categoryName: string | null;
  placementType: string;
  placementMethod: string;
  status: string;
  score: number | null;
  overall: number | null;
  donorQuality: number | null;
  risk: string | null;
  traffic: number | null;
  authority: number | null;
  geographicRelevance: number | null;
  automationAvailable: boolean;
  effort: number;
}

interface ComparisonResult {
  items: ComparisonRow[];
  recommendation: { winnerId: string; reason: string } | null;
}

function buildComparison(rows: OpportunityRow[]): ComparisonResult {
  const items: ComparisonRow[] = rows.map((row) => {
    const authority = row.donorQuality?.authority.value ?? null;
    const geographicRelevance =
      row.donorQuality?.geographicRelevance.value ?? row.scoreBreakdown?.geographicRelevance ?? null;
    return {
      id: row.id,
      platformName: row.platformName,
      platformUrl: row.platformUrl,
      categoryName: row.categoryName,
      placementType: row.placementType,
      placementMethod: row.placementMethod,
      status: row.status,
      score: row.score,
      overall: row.overallScore,
      donorQuality: row.donorQualityScore,
      risk: row.risk?.level ?? null,
      traffic: row.traffic,
      authority: typeof authority === 'number' ? authority : null,
      geographicRelevance: typeof geographicRelevance === 'number' ? geographicRelevance : null,
      automationAvailable: row.automationAvailable,
      effort: easeRank(row),
    };
  });
  const recommendation = recommendationFor(items);
  return { items, recommendation };
}

function recommendationFor(items: ComparisonRow[]): ComparisonResult['recommendation'] {
  if (items.length <= 1) return null;
  const ranked = [...items].sort(
    (a, b) =>
      (b.overall ?? b.score ?? -1) - (a.overall ?? a.score ?? -1) ||
      riskRankByLevel(a.risk) - riskRankByLevel(b.risk) ||
      (b.donorQuality ?? -1) - (a.donorQuality ?? -1),
  );
  const winner = ranked[0];
  if (winner === undefined) return null;
  const breakdown: string[] = [];
  breakdown.push(
    `наивысшая итоговая оценка ${winner.overall ?? winner.score ?? '—'} из ${items.length} сравниваемых`,
  );
  if (winner.donorQuality !== null) {
    breakdown.push(`лучшее качество донора (${winner.donorQuality})`);
  }
  breakdown.push(`риск: ${winner.risk ?? 'не оценивался'}`);
  if (winner.authority !== null) {
    breakdown.push(`авторитетность ${winner.authority}`);
  }
  return {
    winnerId: winner.id,
    reason: `Площадка «${winner.platformName}» рекомендуется первой, потому что ${breakdown.join('; ')}.`,
  };
}

function riskRankByLevel(level: string | null): number {
  switch (level) {
    case 'LOW':
      return 0;
    case 'MEDIUM':
      return 1;
    case 'UNKNOWN':
      return 2;
    case 'HIGH':
      return 3;
    default:
      return 2;
  }
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
