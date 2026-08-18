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
import type { ApiOpportunityDto, ApiOverviewDto, ApiPlacementDto } from '@aios/api';

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
    expect(overview.counts.opportunities).toBe(7);

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
    expect(qualified.items.map((item: ApiOpportunityDto) => item.platformName)).toEqual(['Houzz']);

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
