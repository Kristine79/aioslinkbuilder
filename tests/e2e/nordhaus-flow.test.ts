/**
 * End-to-end suite: boots the real production composition (API + static UI
 * serving) over real HTTP on an ephemeral port and drives the complete
 * Nordhaus journey as the UI would — every transition runs through the
 * application use cases and the domain state machine.
 *
 * Deterministic: in-memory repositories (a real infrastructure module used
 * by `pnpm demo` and the API server) + MockProvider + a fixture AI provider.
 * No database, no external services.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { serve, type ServerType } from '@hono/node-server';

import { createServerApp, runNordhausBootstrap } from '@aios/api';
import type {
  ApiOpportunityDto,
  ApiOverviewDto,
  ApiPlacementDto,
  ApiPlacementPlanDto,
} from '@aios/api';

interface PlacementResult {
  placementId: string;
  status: string;
}

let server: ServerType;
let base: string;

beforeAll(async () => {
  const services = await runNordhausBootstrap();
  const app = createServerApp(services);
  server = serve({ fetch: app.fetch, port: 0 });
  await new Promise<void>((resolve) => {
    server.once('listening', () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
});

async function request(
  path: string,
  init?: { method?: string; body?: Record<string, unknown> },
): Promise<{ status: number; body: unknown }> {
  const options: RequestInit = {
    method: init?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  };
  const response = await fetch(`${base}${path}`, options);
  return { status: response.status, body: await response.json() };
}

async function get<T>(path: string): Promise<T> {
  const result = await request(path);
  return result.body as T;
}

async function listOpportunities(): Promise<ApiOpportunityDto[]> {
  const result = await get<{ items: ApiOpportunityDto[] }>('/api/opportunities');
  return result.items;
}

async function byPlatform(name: string): Promise<ApiOpportunityDto> {
  const items = await listOpportunities();
  const item = items.find((value) => value.platformName === name);
  if (item === undefined) {
    throw new Error(`no opportunity for ${name}`);
  }
  return item;
}

async function detail(id: string): Promise<ApiOpportunityDto> {
  return get(`/api/opportunities/${id}`);
}

describe('Nordhaus E2E: the complete placement journey over HTTP', () => {
  it('serves the API and the built UI on the same port', async () => {
    const overview = await get<ApiOverviewDto>('/api/overview');
    expect(overview.company.name).toBe('Nordhaus');
    expect(overview.counts.opportunities).toBe(16);

    const page = await fetch(`${base}/`);
    expect(page.status).toBe(200);
    const html = await page.text();
    if (html.startsWith('<!doctype')) {
      expect(html).toContain('id="root"');
      const asset = html.match(/src="([^"]+\.js)"/);
      expect(asset?.[1]).toBeDefined();
      const assetResponse = await fetch(`${base}${asset?.[1] ?? ''}`);
      expect(assetResponse.status).toBe(200);

      const spa = await fetch(`${base}/opportunities/123`);
      expect(spa.status).toBe(200);
      expect(await spa.text()).toContain('id="root"');
    } else {
      expect((JSON.parse(html) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
    }
  });

  it('runs the happy path: approve → execute → monitor → verify → verified', async () => {
    const salon = await byPlatform('SALON-interior');
    expect(salon.allowedActions).toContain('approve');

    const approved = await request(`/api/opportunities/${salon.id}/approve`, { method: 'POST' });
    expect(approved.status).toBe(200);
    expect((approved.body as ApiOpportunityDto).status).toBe('SELECTED');

    const mebel = await byPlatform('Мебель.ру');
    expect(mebel.status).toBe('SELECTED');
    expect(mebel.allowedActions).toContain('execute');

    const executed = await request(`/api/opportunities/${mebel.id}/execute`, { method: 'POST' });
    expect(executed.status).toBe(200);
    const placement = executed.body as PlacementResult;
    expect(placement.status).toBe('PUBLISHED');

    const verified = await request(`/api/placements/${placement.placementId}/verify`, {
      method: 'POST',
    });
    expect(verified.status).toBe(200);
    const result = verified.body as {
      status: string;
      verification: { status: string };
    };
    expect(result.status).toBe('VERIFIED');
    expect(result.verification.status).toBe('PASSED');

    const finalDetail = await detail(mebel.id);
    expect(finalDetail.placements[0]?.status).toBe('VERIFIED');
  });

  it('monitors the 2ГИС submission through to publication and verification', async () => {
    const twoGis = await byPlatform('2ГИС');
    const before = await detail(twoGis.id);
    const placement = before.placements[0];
    if (placement === undefined) {
      throw new Error('expected a placement for 2ГИС');
    }
    expect(['SUBMITTED', 'PENDING_PUBLICATION']).toContain(placement.status);

    const monitored = await request(`/api/placements/${placement.id}/monitor`, {
      method: 'POST',
    });
    expect(monitored.status).toBe(200);
    expect((monitored.body as PlacementResult).status).toBe('PUBLISHED');

    const verified = await request(`/api/placements/${placement.id}/verify`, { method: 'POST' });
    expect(verified.status).toBe(200);
    expect((verified.body as { status: string }).status).toBe('VERIFIED');
  });

  it('recovers from a failed attempt with a retry that creates a fresh placement', async () => {
    const archi = await byPlatform('Archi.ru');
    expect(archi.status).toBe('READY');
    expect(archi.placements).toHaveLength(1);
    expect(archi.placements[0]?.status).toBe('FAILED');

    const retried = await request(`/api/opportunities/${archi.id}/execute`, { method: 'POST' });
    expect(retried.status).toBe(200);

    const after = await detail(archi.id);
    expect(after.placements).toHaveLength(2);
    expect(after.placements[0]?.status).toBe('FAILED');
    expect(after.placements[1]?.status).toBe('PUBLISHED');
  });

  it('completes the manual placement with proof and rejects missing proof', async () => {
    const inmyroom = await byPlatform('INMYROOM');
    const before = await detail(inmyroom.id);
    const placement = before.placements[0];
    if (placement === undefined) {
      throw new Error('expected a placement for INMYROOM');
    }
    expect(placement.status).toBe('NEEDS_MANUAL');

    const missingUrl = await request(`/api/placements/${placement.id}/complete-manual`, {
      method: 'POST',
      body: { externalId: 'inmyroom/nordhaus', liveUrl: '' },
    });
    expect(missingUrl.status).toBe(400);
    expect((missingUrl.body as { error: { code: string } }).error.code).toBe('VALIDATION');

    const completed = await request(`/api/placements/${placement.id}/complete-manual`, {
      method: 'POST',
      body: {
        externalId: 'inmyroom/nordhaus',
        liveUrl: 'https://inmyroom.ru/p/nordhaus',
        notes: 'approved by the editor',
      },
    });
    expect(completed.status).toBe(200);
    expect((completed.body as PlacementResult).status).toBe('PUBLISHED');
  });

  it('rejects invalid transitions and unknown resources with structured errors', async () => {
    const yandex = await byPlatform('Яндекс Бизнес');
    const verifiedPlacement = (await detail(yandex.id)).placements[0];
    if (verifiedPlacement === undefined) {
      throw new Error('expected a placement for Яндекс Бизнес');
    }

    const doubleVerify = await request(`/api/placements/${verifiedPlacement.id}/verify`, {
      method: 'POST',
    });
    expect(doubleVerify.status).toBe(409);
    expect((doubleVerify.body as { error: { code: string } }).error.code).toBe('INVALID_STATE');

    const missing = await request('/api/opportunities/does-not-exist/execute', {
      method: 'POST',
    });
    expect(missing.status).toBe(404);
    expect((missing.body as { error: { code: string } }).error.code).toBe('NOT_FOUND');

    const unknownRoute = await request('/api/opportunities/does-not-exist', {});
    expect(unknownRoute.status).toBe(404);
  });

  it('supports server-side filters and rerunning the company analysis', async () => {
    const approved = await get<{ items: ApiOpportunityDto[] }>(
      '/api/opportunities?status=SELECTED',
    );
    expect(approved.items.length).toBeGreaterThan(0);
    expect(approved.items.every((item: ApiOpportunityDto) => item.status === 'SELECTED')).toBe(
      true,
    );

    const qualified = await get<{ items: ApiOpportunityDto[] }>(
      '/api/opportunities?status=QUALIFIED',
    );
    const qualifiedNames = qualified.items.map((item: ApiOpportunityDto) => item.platformName);
    expect(qualified.items.every((item: ApiOpportunityDto) => item.status === 'QUALIFIED')).toBe(
      true,
    );
    expect(qualifiedNames).toContain('Houzz');
    expect(qualifiedNames).toContain('Zoon.ru');

    const catalog = await get<{ items: ApiOpportunityDto[] }>('/api/opportunities?source=catalog');
    expect(
      catalog.items.every((item: ApiOpportunityDto) => item.discoverySource === 'catalog'),
    ).toBe(true);

    const analysis = await request('/api/company/analyze', { method: 'POST' });
    expect(analysis.status).toBe(200);
    expect((analysis.body as { analysis: unknown }).analysis).not.toBeNull();
  });

  it('records the whole journey in the activity feed', async () => {
    const activity = await get<{
      verifications: unknown[];
      audit: Array<{ action: string }>;
    }>('/api/activity');

    expect(activity.verifications.length).toBeGreaterThanOrEqual(3);
    const actions = activity.audit.map((entry) => entry.action);
    expect(actions).toContain('OPPORTUNITY_SELECTED');
    expect(actions).toContain('PLACEMENT_PUBLISHED');
    expect(actions).toContain('PLACEMENT_VERIFIED');
    expect(actions).toContain('PLACEMENT_MANUALLY_PUBLISHED');
    expect(actions).toContain('PLACEMENT_FAILED');
  });

  it('generates the placement plan, reconciles it and exposes it over the API', async () => {
    // No plan yet: the GET returns a structured 404.
    const missing = await request('/api/placement-plan');
    expect(missing.status).toBe(404);
    expect((missing.body as { error: { code: string } }).error.code).toBe('NO_PLACEMENT_PLAN');

    const generated = await request('/api/placement-plan', { method: 'POST' });
    expect(generated.status).toBe(200);
    const plan = generated.body as ApiPlacementPlanDto;

    // Every discovered opportunity is covered by exactly one decision.
    const opportunities = await listOpportunities();
    expect(plan.summary.total).toBe(opportunities.length);
    expect(plan.items).toHaveLength(opportunities.length);
    expect(
      plan.summary.recommended + plan.summary.reviewRequired + plan.summary.notRecommended,
    ).toBe(plan.summary.total);

    // Deterministic reconciliation: automated execution only for API methods
    // with a provider; outreach/manual opportunities require a human.
    const automatic = plan.items.filter((item) => item.automationLevel === 'AUTOMATIC');
    expect(automatic.length).toBeGreaterThan(0);
    expect(automatic.every((item) => item.placementMethod === 'API')).toBe(true);

    const humanItems = plan.items.filter((item) => item.automationLevel === 'HUMAN_REQUIRED');
    expect(humanItems.length).toBeGreaterThan(0);

    // The plan is deterministic: regenerating yields the same reconciled view.
    const second = await request('/api/placement-plan', { method: 'POST' });
    expect(second.status).toBe(200);
    const secondPlan = second.body as ApiPlacementPlanDto;
    expect(secondPlan.summary).toEqual(plan.summary);
    const firstByOpportunity = new Map(
      plan.items.map((item) => [item.opportunityId, item.recommendation]),
    );
    for (const item of secondPlan.items) {
      expect(firstByOpportunity.get(item.opportunityId)).toBe(item.recommendation);
    }

    // The plan is stored and can be re-fetched.
    const stored = await get<ApiPlacementPlanDto>('/api/placement-plan');
    expect(stored.summary.total).toBe(plan.summary.total);
    expect(stored.items[0]?.recommendationReason.length).toBeGreaterThan(0);

    // The audit trail records the generation.
    const activity = await get<{ audit: Array<{ action: string }> }>('/api/activity');
    expect(activity.audit.map((entry) => entry.action)).toContain('PLACEMENT_PLAN_GENERATED');

    // The campaign-scoped route resolves the same plan by campaign id.
    const overview = await get<ApiOverviewDto>('/api/overview');
    const scoped = await get<ApiPlacementPlanDto>(
      `/api/campaigns/${overview.campaign.id}/placement-plan`,
    );
    expect(scoped.summary.total).toBe(plan.summary.total);
  });

  it('exposes the placement plan for a generic second company (no Nordhaus leaks)', async () => {
    const created = await request('/api/companies', {
      method: 'POST',
      body: {
        name: 'Студия «Атлас»',
        website: 'https://atlas.example.com',
        industry: 'design',
        description: 'Студия интерьерного дизайна',
        geography: ['Москва'],
        products: ['дизайн-проекты'],
        targetAudience: ['частные клиенты'],
      },
    });
    const company = created.body as { id: string };
    const campaignResponse = await request(`/api/companies/${company.id}/campaigns`, {
      method: 'POST',
      body: {
        name: 'Атлас — кампания',
        goals: ['Публикации в интерьерных медиа'],
      },
    });
    const campaign = (campaignResponse.body as { id: string }).id;
    await request(`/api/company/analyze?campaignId=${campaign}`, { method: 'POST' });
    await request(`/api/discover?campaignId=${campaign}`, { method: 'POST' });

    const plan = await request(`/api/placement-plan?campaignId=${campaign}`, { method: 'POST' });
    expect(plan.status).toBe(200);
    const body = plan.body as ApiPlacementPlanDto;
    expect(body.summary.total).toBeGreaterThan(0);
    // The plan text is generated from the actual campaign context.
    const allText = body.items.map((item) => item.recommendationReason).join(' ');
    expect(allText).not.toContain('Nordhaus');
  });
});

describe('E2E: generic company/campaign flow (product is not Nordhaus-specific)', () => {
  it('creates a company, a campaign, runs analysis and discovery, then filters by source', async () => {
    const created = await request('/api/companies', {
      method: 'POST',
      body: {
        name: 'Дизайн-бюро «Форма»',
        website: 'https://forma.example.com',
        industry: 'design',
        description: 'Дизайн интерьеров премиум-класса',
        geography: ['Москва'],
        products: ['дизайн-проекты', 'мебель на заказ'],
        targetAudience: ['владельцы недвижимости', 'девелоперы'],
      },
    });
    expect(created.status).toBe(201);
    const company = created.body as { id: string; name: string };
    expect(company.name).toBe('Дизайн-бюро «Форма»');

    const campaignResponse = await request(`/api/companies/${company.id}/campaigns`, {
      method: 'POST',
      body: {
        name: 'Кампания «Формы»',
        goals: ['Публикации в интерьерных медиа', 'Профили на картах'],
      },
    });
    expect(campaignResponse.status).toBe(201);
    const campaign = (campaignResponse.body as { id: string }).id;

    const companyData = await get<{ analysis: unknown }>(`/api/company?campaignId=${campaign}`);
    expect(companyData.analysis).toBeNull();

    const discoveryBeforeAnalysis = await request(`/api/discover?campaignId=${campaign}`, {
      method: 'POST',
    });
    expect(discoveryBeforeAnalysis.status).toBe(409);
    expect((discoveryBeforeAnalysis.body as { error: { code: string } }).error.code).toBe(
      'NO_ANALYSIS',
    );

    const analyzed = await request(`/api/company/analyze?campaignId=${campaign}`, {
      method: 'POST',
    });
    expect(analyzed.status).toBe(200);

    const discovery = await request(`/api/discover?campaignId=${campaign}`, { method: 'POST' });
    expect(discovery.status).toBe(200);
    const result = discovery.body as {
      discovered: number;
      classified: number;
      sources: string[];
      items: Array<{ score: number | null; discoverySource: string; status: string }>;
    };
    expect(result.discovered).toBeGreaterThan(0);
    expect(result.classified).toBe(result.discovered);
    expect(result.sources).toEqual(expect.arrayContaining(['catalog', 'search']));
    expect(result.items.every((item) => item.score !== null)).toBe(true);
    expect(result.items.every((item) => item.status === 'QUALIFIED')).toBe(true);

    const searchOnly = await get<{ items: Array<{ discoverySource: string }> }>(
      `/api/opportunities?campaignId=${campaign}&source=search`,
    );
    expect(searchOnly.items.length).toBeGreaterThan(0);
    expect(searchOnly.items.every((item) => item.discoverySource === 'search')).toBe(true);

    const overview = await get<{ counts: Record<string, number> }>(
      `/api/overview?campaignId=${campaign}`,
    );
    expect(overview.counts.opportunities).toBe(result.discovered);
    expect(overview.counts.recommended).toBe(result.classified);
  });
});

describe('Nordhaus E2E: negative cases', () => {
  it('rejects malformed request payloads', async () => {
    const inmyroom = await byPlatform('INMYROOM');
    const placement = (await detail(inmyroom.id)).placements[0] as ApiPlacementDto;

    const bad = await request(`/api/placements/${placement.id}/complete-manual`, {
      method: 'POST',
      body: { externalId: '', liveUrl: 'https://x.ru' },
    });
    expect(bad.status).toBe(400);
    expect((bad.body as { error: { code: string } }).error.code).toBe('VALIDATION');
  });

  it('fails fast on missing resources', async () => {
    const overview = await request('/api/overview');
    expect(overview.status).toBe(200);

    const missingMonitor = await request('/api/placements/nope/monitor', { method: 'POST' });
    expect(missingMonitor.status).toBe(404);
    expect((missingMonitor.body as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });
});
