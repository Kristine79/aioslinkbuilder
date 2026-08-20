/**
 * Server-side discovery state for the active campaign.
 *
 * The backend is the single source of truth for discovery state (NOT_RUN /
 * RUNNING / COMPLETED_WITH_RESULTS / COMPLETED_EMPTY / FAILED plus run
 * metadata). The UI never derives business state from sessionStorage or the
 * audit trail: it reads the persisted discovery run from the API and simply
 * re-fetches after a discovery run completes.
 */

import { useCallback, useEffect, useState } from 'react';

import { api } from './api/client';
import type { DiscoveryStateDto } from './api/types';

export const NOT_RUN_DISCOVERY_STATE: DiscoveryStateDto = {
  campaignId: '',
  status: 'NOT_RUN',
  lastRunAt: null,
  discoveredCount: 0,
  classifiedCount: 0,
  sources: [],
  failure: null,
};

/** Whether the status means a discovery attempt has actually run (or is running). */
export function discoveryHasRun(status: DiscoveryStateDto['status']): boolean {
  return (
    status === 'RUNNING' ||
    status === 'COMPLETED_WITH_RESULTS' ||
    status === 'COMPLETED_EMPTY' ||
    status === 'FAILED'
  );
}

export interface DiscoveryState {
  state: DiscoveryStateDto;
  refresh: () => void;
  hasRun: boolean;
}

/** Loads the persisted discovery state for the active campaign on mount. */
export function useDiscoveryState(): DiscoveryState {
  const [state, setState] = useState<DiscoveryStateDto>(NOT_RUN_DISCOVERY_STATE);

  const refresh = useCallback(() => {
    api
      .discoveryState()
      .then(setState)
      .catch(() => {
        // The empty state stays NOT_RUN until the backend answers.
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { state, refresh, hasRun: discoveryHasRun(state.status) };
}
