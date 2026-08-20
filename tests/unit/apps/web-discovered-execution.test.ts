import { describe, expect, it } from 'vitest';

import { runNordhausBootstrap, createApiApp } from '@aios/api';
import type { ApiOpportunityDto } from '@aios/api';

async function setup() {
  const bootstrap = await runNordhausBootstrap();
  const app = createApiApp(bootstrap);
  return { app, env: bootstrap.env, campaign: bootstrap.campaign };
}

async function get<T>(app: ReturnType<typeof createApiApp>, path: string): Promise<T> {
  return (await app.request(path)).json() as Promise<T>;
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

describe('REPRO: web-discovered platform without provider', () => {
  it('exposes the gap', async () => {
    const { app, env, campaign } = await setup();

    // Simulate a web-discovered platform: persisted with no provider record.
    const platform = await env.lookups.createPlatform({
      id: 'platform-ws-dyatkovo-ru-7plrn2',
      name: 'Дятьково (каталог мебели)',
      url: 'https://dyatkovo.ru',
      country: 'RU',
      categoryId: 'cat-web-directories',
      notes: 'Найдено через веб-поиск',
      metadata: { discoveredVia: 'web-search' },
    });
    const opportunity = await env.opportunities.create({
      campaignId: campaign.id,
      platformId: platform.id,
      placementType: 'DIRECTORY_LISTING',
      placementMethod: 'UNKNOWN',
      categoryId: platform.categoryId ?? null,
      metadata: { discoverySource: 'web-search' },
    });
    // Set deterministic score + QUALIFIED, mirroring the classify use case.
    await env.opportunities.update({
      ...opportunity,
      status: 'QUALIFIED',
      score: 79,
      scoreBreakdown: {
        total: 79,
        topicalRelevance: 70,
        audienceMatch: 75,
        geographicRelevance: 80,
        authority: 60,
        placementQuality: 65,
        automationPotential: 50,
      },
      recommendation: 'Сильная релевантность',
      whyRecommended: 'Площадка релевантна мебельной теме',
      updatedAt: new Date(),
    });

    const before = await get<ApiOpportunityDto>(app, `/api/opportunities/${opportunity.id}`);
    console.log(
      `before approve: status=${before.status} method=${before.placementMethod} provider=${JSON.stringify(before.provider)} allowedActions=${JSON.stringify(before.allowedActions)} caps=${JSON.stringify(before.providerCapabilities)}`,
    );

    const approve = await post(app, `/api/opportunities/${opportunity.id}/approve`);
    expect(approve.status).toBe(200);
    const selected = (await approve.json()) as ApiOpportunityDto;
    console.log(
      `after approve: status=${selected.status} method=${selected.placementMethod} provider=${JSON.stringify(selected.provider)} allowedActions=${JSON.stringify(selected.allowedActions)}`,
    );

    // The bug report: UI offered "Запустить"; backend returned NO_PROVIDER.
    const execute = await post(app, `/api/opportunities/${opportunity.id}/execute`);
    const body = (await execute.json()) as { error?: { code?: string; message?: string } };
    console.log(`execute -> HTTP ${execute.status} code=${body.error?.code ?? '-'} msg=${body.error?.message ?? '-'}`);

    expect(execute.status).toBe(422);
    expect(body.error?.code).toBe('NO_PROVIDER');

    // Desired: UI must NOT offer execute for this platform; manual placement
    // is the valid path instead of a dead end or a guaranteed backend error.
    expect(selected.allowedActions).not.toContain('execute');
    expect(selected.allowedActions).toContain('requestManual');

    // And the manual path must actually work end-to-end through the API.
    const manualReason = 'Размещение вручную: площадка найдена через веб-поиск, автоматизации нет';
    const requestManual = await post(app, `/api/opportunities/${opportunity.id}/request-manual`, {
      reason: manualReason,
    });
    expect(requestManual.status).toBe(200);
    const manualPlacement = (await requestManual.json()) as {
      placementId: string;
      status: string;
    };
    expect(manualPlacement.status).toBe('NEEDS_MANUAL');

    const completed = await post(app, `/api/placements/${manualPlacement.placementId}/complete-manual`, {
      externalId: 'dyatkovo-ru/furniture-studio',
      liveUrl: 'https://dyatkovo.ru/furniture-studio',
      notes: 'Размещение выполнено вручную через партнёрскую программу',
    });
    expect(completed.status).toBe(200);
    const published = (await completed.json()) as { status: string };
    expect(published.status).toBe('PUBLISHED');
  });
});