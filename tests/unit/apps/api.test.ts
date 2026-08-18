/**
 * Delivery layer tests: the HTTP API composed over the real Nordhaus
 * scenario. Every assertion goes through Hono routes; transitions run the
 * actual application use cases and the domain state machine.
 */

import { describe, expect, it } from 'vitest';

import { runNordhausBootstrap, createApiApp } from '@aios/api';
import type { ApiOpportunityDto, ApiPlacementDto } from '@aios/api';

async function setup() {
  const bootstrap = await runNordhausBootstrap();
  const app = createApiApp(bootstrap);
  return { app, env: bootstrap.env };
}

function json<T = Record<string, unknown>>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function get<T>(app: ReturnType<typeof createApiApp>, path: string): Promise<T> {
  const response = await app.request(path);
  return json<T>(response);
}

async function post(
  app: ReturnType<typeof createApiApp>,
  path: string,
  payload?: Record<string, unknown>,
): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? JSON.stringify({}) : JSON.stringify(payload),
  });
}

async function errorShape(response: Response): Promise<{ code: string; status: number }> {
  const payload = await json(response);
  return {
    status: response.status,
    code: String((payload.error as { code: string }).code),
  };
}

async function findOpportunity(
  app: ReturnType<typeof createApiApp>,
  platformName: string,
): Promise<ApiOpportunityDto> {
  const result = await get<{ items: ApiOpportunityDto[] }>(app, '/api/opportunities');
  const item = result.items.find((value) => value.platformName === platformName);
  if (item === undefined) {
    throw new Error(`no opportunity for ${platformName}`);
  }
  return item;
}

describe('API delivery layer (Nordhaus scenario)', () => {
  it('serves overview counts matching the bootstrapped mid-state', async () => {
    const { app } = await setup();
    const overview = await get<{
      counts: Record<string, number>;
      totalPlacements: number;
      company: { name: string };
    }>(app, '/api/overview');

    expect(overview.company.name).toBe('Nordhaus');
    expect(overview.counts.opportunities).toBe(7);
    expect(overview.counts.recommended).toBe(2);
    expect(overview.counts.approved).toBe(5);
    expect(overview.counts.executed).toBe(4);
    expect(overview.counts.published).toBe(1);
    expect(overview.counts.verified).toBe(1);
    expect(overview.counts.failed).toBe(1);
    expect(overview.counts.manual).toBe(1);
    expect(overview.totalPlacements).toBe(4);
  });

  it('lists opportunities ranked by score with Russian platform names', async () => {
    const { app } = await setup();
    const result = await get<{ items: ApiOpportunityDto[] }>(app, '/api/opportunities');

    expect(result.items).toHaveLength(7);
    expect(result.items[0]?.platformName).toBe('Яндекс Бизнес');
    const scores = result.items.map((item) => item.score ?? 0);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('filters opportunities by status through query params', async () => {
    const { app } = await setup();
    const result = await get<{ items: ApiOpportunityDto[] }>(
      app,
      '/api/opportunities?status=QUALIFIED',
    );

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.platformName).sort()).toEqual([
      'Houzz',
      'SALON-interior',
    ]);
  });

  it('returns opportunity detail with placements, verification and allowed actions', async () => {
    const { app } = await setup();
    const yandex = await findOpportunity(app, 'Яндекс Бизнес');
    const detail = await get<ApiOpportunityDto>(app, `/api/opportunities/${yandex.id}`);

    expect(detail.status).toBe('READY');
    expect(detail.allowedActions).toEqual(['execute']);
    expect(detail.placements).toHaveLength(1);
    const placement = detail.placements[0];
    if (placement === undefined) {
      throw new Error('expected a placement for Яндекс Бизнес');
    }
    expect(placement.status).toBe('VERIFIED');
    expect(placement.allowedActions).toEqual([]);
    expect(placement.verification).not.toBeNull();
    expect(placement.evidence.length).toBeGreaterThan(0);
  });

  it('approves an opportunity through the API', async () => {
    const { app } = await setup();
    const salon = await findOpportunity(app, 'SALON-interior');
    expect(salon.allowedActions).toContain('approve');

    const response = await post(app, `/api/opportunities/${salon.id}/approve`);
    expect(response.status).toBe(200);
    const updated = await json<ApiOpportunityDto>(response);
    expect(updated.status).toBe('SELECTED');

    const again = await post(app, `/api/opportunities/${salon.id}/approve`);
    expect(await errorShape(again)).toEqual({ status: 409, code: 'INVALID_STATE' });
  });

  it('executes and verifies mebel (mock always publishes)', async () => {
    const { app } = await setup();
    const mebel = await findOpportunity(app, 'Мебель.ру');
    expect(mebel.allowedActions).toContain('execute');

    const executed = await post(app, `/api/opportunities/${mebel.id}/execute`);
    expect(executed.status).toBe(200);
    const placement = await json<{ placementId: string; status: string }>(executed);
    expect(placement.status).toBe('PUBLISHED');

    const verified = await post(app, `/api/placements/${placement.placementId}/verify`);
    expect(verified.status).toBe(200);
    const result = await json<{
      status: string;
      verification: { status: string };
    }>(verified);
    expect(result.status).toBe('VERIFIED');
    expect(result.verification.status).toBe('PASSED');
  });

  it('monitors the 2GIS placement through the submitted pipeline', async () => {
    const { app } = await setup();
    const twoGis = await findOpportunity(app, '2ГИС');
    expect(twoGis.status).toBe('READY');

    const detail = await get<ApiOpportunityDto>(app, `/api/opportunities/${twoGis.id}`);
    const twoGisPlacement = detail.placements[0];
    if (twoGisPlacement === undefined) {
      throw new Error('expected a placement for 2ГИС');
    }
    expect(['SUBMITTED', 'PENDING_PUBLICATION']).toContain(twoGisPlacement.status);
    expect(twoGisPlacement.allowedActions).toContain('monitor');

    const response = await post(app, `/api/placements/${twoGisPlacement.id}/monitor`);
    expect(response.status).toBe(200);
    const result = await json<{ status: string }>(response);
    expect(result.status).toBe('PUBLISHED');
  });

  it('retries the failed archi.ru attempt with a fresh placement', async () => {
    const { app } = await setup();
    const archi = await findOpportunity(app, 'Archi.ru');
    expect(archi.status).toBe('READY');
    expect(archi.placements).toHaveLength(1);
    const failedAttempt = archi.placements[0];
    if (failedAttempt === undefined) {
      throw new Error('expected a failed attempt for Archi.ru');
    }
    expect(failedAttempt.status).toBe('FAILED');

    const response = await post(app, `/api/opportunities/${archi.id}/execute`);
    expect(response.status).toBe(200);

    const detail = await get<ApiOpportunityDto>(app, `/api/opportunities/${archi.id}`);
    expect(detail.placements).toHaveLength(2);
    expect(detail.placements[1]?.status).toBe('PUBLISHED');
    expect(
      detail.placements.some((placement: ApiPlacementDto) => placement.status === 'FAILED'),
    ).toBe(true);
  });

  it('requires a reason to move a manual opportunity and completes it', async () => {
    const { app } = await setup();
    const inmyroom = await findOpportunity(app, 'INMYROOM');
    expect(inmyroom.status).toBe('NEEDS_MANUAL');

    const bad = await post(app, `/api/opportunities/${inmyroom.id}/request-manual`, {});
    expect(await errorShape(bad)).toEqual({ status: 400, code: 'VALIDATION' });

    const detail = await get<ApiOpportunityDto>(app, `/api/opportunities/${inmyroom.id}`);
    const placement = detail.placements[0];
    if (placement === undefined) {
      throw new Error('expected a placement for INMYROOM.ru');
    }
    expect(placement.status).toBe('NEEDS_MANUAL');
    expect(placement.allowedActions).toContain('completeManual');

    const withoutUrl = await post(app, `/api/placements/${placement.id}/complete-manual`, {
      externalId: 'inmyroom/nordhaus',
      liveUrl: '',
    });
    expect(await errorShape(withoutUrl)).toEqual({ status: 400, code: 'VALIDATION' });

    const completed = await post(app, `/api/placements/${placement.id}/complete-manual`, {
      externalId: 'inmyroom/nordhaus',
      liveUrl: 'https://inmyroom.ru/p/nordhaus',
      notes: 'profile approved by the editor',
    });
    expect(completed.status).toBe(200);
    const result = await json<{ status: string }>(completed);
    expect(result.status).toBe('PUBLISHED');
  });

  it('returns 404 for unknown resources and 409 for invalid transitions', async () => {
    const { app } = await setup();

    const missingOpportunity = await app.request('/api/opportunities/does-not-exist');
    expect(await errorShape(missingOpportunity)).toEqual({ status: 404, code: 'NOT_FOUND' });

    const missingPlacement = await post(app, '/api/placements/does-not-exist/monitor');
    expect(await errorShape(missingPlacement)).toEqual({ status: 404, code: 'NOT_FOUND' });

    const yandex = await findOpportunity(app, 'Яндекс Бизнес');
    const afterVerify = await get<ApiOpportunityDto>(app, `/api/opportunities/${yandex.id}`);
    const verifiedPlacement = afterVerify.placements[0];
    if (verifiedPlacement === undefined) {
      throw new Error('expected a placement for Яндекс Бизнес');
    }
    const doubleVerify = await post(app, `/api/placements/${verifiedPlacement.id}/verify`);
    expect(await errorShape(doubleVerify)).toEqual({ status: 409, code: 'INVALID_STATE' });
  });

  it('serves the activity feed with verifications and audit entries', async () => {
    const { app } = await setup();
    const activity = await get<{ verifications: unknown[]; audit: unknown[] }>(
      app,
      '/api/activity',
    );

    expect(activity.verifications.length).toBeGreaterThanOrEqual(1);
    expect(activity.audit.length).toBeGreaterThan(10);
  });
});
