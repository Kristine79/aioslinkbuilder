import type { DiscoveryRun } from '@aios/domain';
import type { DiscoveryRunRepository } from '@aios/application';

/**
 * In-memory implementation of DiscoveryRunRepository. Used by the prototype
 * demo, the API composition and tests; the Prisma repository remains the
 * production path.
 */
export class InMemoryDiscoveryRunRepository implements DiscoveryRunRepository {
  readonly runs = new Map<string, DiscoveryRun>();

  findLatestForCampaign(campaignId: string): Promise<DiscoveryRun | null> {
    return Promise.resolve(this.runs.get(campaignId) ?? null);
  }

  save(run: DiscoveryRun): Promise<DiscoveryRun> {
    this.runs.set(run.campaignId, run);
    return Promise.resolve(run);
  }
}
