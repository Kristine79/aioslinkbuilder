/**
 * Discovery run state — the durable, server-side record of a discovery run
 * for a campaign.
 *
 * The backend is the single source of truth for discovery state. Every
 * discovery attempt persists a discovery run: RUNNING while the pipeline is
 * in flight, then exactly one terminal state:
 * - COMPLETED_WITH_RESULTS — the sources produced new opportunities;
 * - COMPLETED_EMPTY       — the sources ran successfully but found nothing;
 * - FAILED                — a provider/source error aborted the run.
 *
 * NOT_RUN is a derived state: a campaign without any discovery run has never
 * been searched. It is never stored as a row — the repository returns null
 * and the delivery layer serializes it as NOT_RUN.
 */

export const DISCOVERY_RUN_STATUSES = [
  'NOT_RUN',
  'RUNNING',
  'COMPLETED_WITH_RESULTS',
  'COMPLETED_EMPTY',
  'FAILED',
] as const;

export type DiscoveryRunStatus = (typeof DISCOVERY_RUN_STATUSES)[number];

export interface DiscoveryRun {
  campaignId: string;
  status: DiscoveryRunStatus;
  lastRunAt: Date;
  discoveredCount: number;
  classifiedCount: number;
  sources: string[];
  failure: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The outcome of a completed discovery run. */
export interface DiscoveryRunCompletion {
  discoveredCount: number;
  classifiedCount: number;
  sources: string[];
}

/** Opens a discovery run: the campaign transitions from NOT_RUN to RUNNING. */
export function startDiscoveryRun(campaignId: string, now: Date): DiscoveryRun {
  return {
    campaignId,
    status: 'RUNNING',
    lastRunAt: now,
    discoveredCount: 0,
    classifiedCount: 0,
    sources: [],
    failure: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Marks the run as a provider/source failure. A failed run must never be
 * reported as COMPLETED_EMPTY — the UI distinguishes "no results" from
 * "the search did not complete".
 */
export function failDiscoveryRun(run: DiscoveryRun, failure: string, now: Date): DiscoveryRun {
  return {
    ...run,
    status: 'FAILED',
    failure,
    lastRunAt: now,
    updatedAt: now,
  };
}

/** Completes a run: WITH_RESULTS when something was discovered, else EMPTY. */
export function completeDiscoveryRun(
  run: DiscoveryRun,
  outcome: DiscoveryRunCompletion,
  now: Date,
): DiscoveryRun {
  return {
    ...run,
    status: outcome.discoveredCount > 0 ? 'COMPLETED_WITH_RESULTS' : 'COMPLETED_EMPTY',
    discoveredCount: outcome.discoveredCount,
    classifiedCount: outcome.classifiedCount,
    sources: [...outcome.sources],
    failure: null,
    lastRunAt: now,
    updatedAt: now,
  };
}
