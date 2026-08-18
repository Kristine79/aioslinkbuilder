/**
 * HTTP delivery layer: routes, request parsing and error mapping only.
 * All state changes go through application use cases; the domain state
 * machine remains the source of truth. No business logic lives here.
 */

import { Hono } from 'hono';

import {
  AnalyzeCompanyUseCase,
  ApproveOpportunityUseCase,
  CompleteManualPlacementUseCase,
  ExecutePlacementUseCase,
  GeneratePlacementStrategyUseCase,
  MonitorPlacementUseCase,
  NoProviderAssignedError,
  NoProviderAvailableError,
  NotFoundError,
  RequestManualPlacementUseCase,
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
  type ApiCategoryDto,
  type ApiCompanyDto,
  type ApiOverviewDto,
  type ApiStrategyItemDto,
} from './dto.js';
import type { NordhausEnvironment } from './scenario/nordhaus-environment.js';

export interface ApiServices {
  env: NordhausEnvironment;
  company: Company;
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

  app.get('/api/meta', async (c) => {
    const categories: ApiCategoryDto[] = (await env.lookups.listCategories()).map((category) => ({
      id: category.id,
      code: category.code,
      name: category.name,
    }));
    return c.json({ categories });
  });

  app.get('/api/company', async (c) => {
    const analysis = await env.analyses.findLatestValidCompanyAnalysis(services.campaign.id);
    const company: ApiCompanyDto = mapCompany(services.company, analysis);
    return c.json(company);
  });

  app.post('/api/company/analyze', async (c) => {
    await analyze.execute({ campaignId: services.campaign.id });
    const analysis = await env.analyses.findLatestValidCompanyAnalysis(services.campaign.id);
    return c.json(mapCompany(services.company, analysis), 200);
  });

  app.get('/api/strategy', async (c) => {
    const result = await strategy.execute({ campaignId: services.campaign.id });
    const categoryNames = new Map(
      (await env.lookups.listCategories()).map((category) => [category.code, category.name]),
    );
    const items: ApiStrategyItemDto[] = result.items.map((item) => ({
      categoryCode: item.categoryCode,
      categoryName: categoryNames.get(item.categoryCode) ?? item.categoryCode,
      placementType: item.placementType,
    }));
    return c.json({ items });
  });

  app.get('/api/opportunities', async (c) => {
    const opportunities = await env.opportunities.findByCampaignId(services.campaign.id);
    const context = await opportunityContext(env);
    const all = await Promise.all(
      opportunities.map((opportunity) => mapOpportunityWithRelations(env, opportunity, context)),
    );

    const category = c.req.query('category');
    const method = c.req.query('method');
    const status = c.req.query('status');
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

  app.get('/api/overview', async (c) => {
    const opportunities = await env.opportunities.findByCampaignId(services.campaign.id);
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
      .slice(-10)
      .map((entry) => mapAuditEvent(entry))
      .reverse();

    const overview: ApiOverviewDto = {
      company: {
        id: services.company.id,
        name: services.company.name,
        industry: services.company.industry,
        website: services.company.website,
      },
      campaign: {
        id: services.campaign.id,
        name: services.campaign.name,
        goals: [...services.campaign.goals],
        status: services.campaign.status,
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
    const opportunities = await env.opportunities.findByCampaignId(services.campaign.id);
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

    const audit = [...env.auditLog.entries].map((entry) => mapAuditEvent(entry)).reverse();

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
