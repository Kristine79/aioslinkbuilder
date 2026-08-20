import { describe, expect, it } from 'vitest';

import {
  completeDiscoveryRun,
  DISCOVERY_RUN_STATUSES,
  failDiscoveryRun,
  startDiscoveryRun,
} from '@aios/domain';

describe('discovery run state', () => {
  it('exposes the exact status vocabulary', () => {
    expect(DISCOVERY_RUN_STATUSES).toEqual([
      'NOT_RUN',
      'RUNNING',
      'COMPLETED_WITH_RESULTS',
      'COMPLETED_EMPTY',
      'FAILED',
    ]);
  });

  it('starts a run in RUNNING with zeroed counters', () => {
    const now = new Date('2026-01-15T10:00:00.000Z');
    const run = startDiscoveryRun('campaign-1', now);

    expect(run).toEqual({
      campaignId: 'campaign-1',
      status: 'RUNNING',
      lastRunAt: now,
      discoveredCount: 0,
      classifiedCount: 0,
      sources: [],
      failure: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  it('completes as COMPLETED_WITH_RESULTS when opportunities were found', () => {
    const run = startDiscoveryRun('campaign-1', new Date());
    const completed = completeDiscoveryRun(
      run,
      { discoveredCount: 3, classifiedCount: 2, sources: ['catalog', 'search'] },
      new Date('2026-01-15T10:05:00.000Z'),
    );

    expect(completed.status).toBe('COMPLETED_WITH_RESULTS');
    expect(completed.discoveredCount).toBe(3);
    expect(completed.classifiedCount).toBe(2);
    expect(completed.sources).toEqual(['catalog', 'search']);
    expect(completed.failure).toBeNull();
  });

  it('completes as COMPLETED_EMPTY when nothing was found', () => {
    const run = startDiscoveryRun('campaign-1', new Date());
    const completed = completeDiscoveryRun(
      run,
      { discoveredCount: 0, classifiedCount: 0, sources: ['catalog'] },
      new Date('2026-01-15T10:05:00.000Z'),
    );

    expect(completed.status).toBe('COMPLETED_EMPTY');
    expect(completed.discoveredCount).toBe(0);
    expect(completed.failure).toBeNull();
  });

  it('never reports a failure as COMPLETED_EMPTY', () => {
    const run = startDiscoveryRun('campaign-1', new Date());
    const failed = failDiscoveryRun(
      run,
      'search provider timed out',
      new Date('2026-01-15T10:05:00.000Z'),
    );

    expect(failed.status).toBe('FAILED');
    expect(failed.failure).toBe('search provider timed out');
    expect(failed.discoveredCount).toBe(0);
  });
});
