import type { DiscoveryRun } from '@aios/domain';

/**
 * Port for persisting the latest discovery run of a campaign.
 *
 * The backend is the single source of truth for discovery state: the UI may
 * keep a session marker as an optimization, but it can never decide business
 * state. A campaign without a run has never been searched (NOT_RUN).
 */
export interface DiscoveryRunRepository {
  findLatestForCampaign(campaignId: string): Promise<DiscoveryRun | null>;
  save(run: DiscoveryRun): Promise<DiscoveryRun>;
}
