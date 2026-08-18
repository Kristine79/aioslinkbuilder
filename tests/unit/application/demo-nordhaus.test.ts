import { describe, expect, it } from 'vitest';

import { runNordhausDemo } from '../../../apps/api/src/scenario/nordhaus-demo.js';

describe('Nordhaus end-to-end demo', () => {
  it('runs the complete pipeline from company analysis to verification', async () => {
    const report = await runNordhausDemo();

    // Placement strategy: category -> placement type mapping is deterministic.
    expect(report.strategyItems).toEqual([
      { categoryCode: 'maps-local', placementType: 'BUSINESS_PROFILE' },
      { categoryCode: 'furniture-directories', placementType: 'DIRECTORY_LISTING' },
      { categoryCode: 'interior-design', placementType: 'EDITORIAL_PUBLICATION' },
      { categoryCode: 'architecture', placementType: 'EDITORIAL_PUBLICATION' },
    ]);

    // Opportunities: 7 discovered (vk excluded by the category filter);
    // alignment branches are deterministic.
    const byPlatform = new Map(report.opportunities.map((o) => [o.platformId, o]));
    expect(byPlatform.size).toBe(7);
    expect(byPlatform.get('platform-yandex-business')).toMatchObject({
      method: 'API',
      status: 'READY',
    });
    expect(byPlatform.get('platform-2gis')).toMatchObject({ method: 'API', status: 'READY' });
    expect(byPlatform.get('platform-mebel-ru')).toMatchObject({ method: 'API', status: 'READY' });
    expect(byPlatform.get('platform-archi-ru')).toMatchObject({ method: 'API', status: 'READY' });
    expect(byPlatform.get('platform-inmyroom')).toMatchObject({
      method: 'MANUAL',
      status: 'NEEDS_MANUAL',
    });
    expect(byPlatform.get('platform-salon-interior')).toMatchObject({
      method: 'UNKNOWN',
      status: 'QUALIFIED',
    });
    expect(byPlatform.get('platform-houzz')).toMatchObject({
      method: 'UNKNOWN',
      status: 'QUALIFIED',
    });

    // Placements: 6 records — 5 VERIFIED + 1 FAILED attempt (archi.ru retry).
    const statuses = report.placements.map((p) => p.status).sort();
    expect(statuses).toEqual([
      'FAILED',
      'VERIFIED',
      'VERIFIED',
      'VERIFIED',
      'VERIFIED',
      'VERIFIED',
    ]);
    expect(report.placements.filter((p) => p.status === 'VERIFIED')).toHaveLength(5);
    expect(report.placements.filter((p) => p.status === 'FAILED')).toHaveLength(1);

    // Every verified placement produced one verification with 4 evidence rows.
    expect(report.verificationCount).toBe(5);
    expect(report.evidenceCount).toBe(20);

    // The audit trail covers the whole lifecycle.
    const actions = report.auditActions;
    expect(actions).toContain('COMPANY_ANALYZED');
    expect(actions.filter((action) => action === 'OPPORTUNITY_DISCOVERED')).toHaveLength(7);
    expect(actions.filter((action) => action === 'OPPORTUNITY_CLASSIFIED')).toHaveLength(7);
    expect(actions.filter((action) => action === 'OPPORTUNITY_SELECTED')).toHaveLength(5);
    expect(actions.filter((action) => action === 'OPPORTUNITY_READY')).toHaveLength(4);
    expect(actions).toContain('PLACEMENT_NEEDS_MANUAL');
    expect(actions).toContain('PLACEMENT_MANUALLY_PUBLISHED');
    expect(actions).toContain('PLACEMENT_FAILED');
    expect(actions).toContain('PLACEMENT_STATUS_CHANGED');
    expect(actions).toContain('PLACEMENT_SUBMITTED');
    // 3 immediate publications (yandex, mebel-ru, archi-ru retry) + 1 via
    // monitoring (2gis) + 1 via manual completion (inmyroom) = 5 published.
    expect(actions.filter((action) => action === 'PLACEMENT_PUBLISHED')).toHaveLength(3);
    expect(actions.filter((action) => action === 'PLACEMENT_VERIFIED')).toHaveLength(5);

    // The audit trail is ordered: analysis -> discovery -> classification ->
    // approval -> execution -> manual -> verification.
    expect(actions.indexOf('COMPANY_ANALYZED')).toBeLessThan(
      actions.indexOf('OPPORTUNITY_DISCOVERED'),
    );
    expect(actions.indexOf('OPPORTUNITY_DISCOVERED')).toBeLessThan(
      actions.indexOf('OPPORTUNITY_CLASSIFIED'),
    );
    expect(actions.indexOf('OPPORTUNITY_SELECTED')).toBeLessThan(
      actions.indexOf('OPPORTUNITY_READY'),
    );
    expect(actions.indexOf('OPPORTUNITY_READY')).toBeLessThan(
      actions.indexOf('PLACEMENT_PUBLISHED'),
    );
    expect(actions.indexOf('PLACEMENT_MANUALLY_PUBLISHED')).toBeLessThan(
      actions.indexOf('PLACEMENT_VERIFIED'),
    );
    expect(actions.lastIndexOf('PLACEMENT_VERIFIED')).toBeGreaterThan(
      actions.indexOf('PLACEMENT_PUBLISHED'),
    );
  });
});
