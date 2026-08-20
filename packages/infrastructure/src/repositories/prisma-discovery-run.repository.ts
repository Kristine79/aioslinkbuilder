import type { PrismaClient, Prisma } from '@prisma/client';
import type { DiscoveryRun } from '@aios/domain';
import type { DiscoveryRunRepository } from '@aios/application';

export class PrismaDiscoveryRunRepository implements DiscoveryRunRepository {
  constructor(private readonly db: PrismaClient) {}

  async findLatestForCampaign(campaignId: string): Promise<DiscoveryRun | null> {
    const row = await this.db.discoveryRun.findUnique({ where: { campaignId } });
    return row === null ? null : toDiscoveryRun(row);
  }

  async save(run: DiscoveryRun): Promise<DiscoveryRun> {
    const row = await this.db.discoveryRun.upsert({
      where: { campaignId: run.campaignId },
      create: {
        campaignId: run.campaignId,
        status: run.status,
        lastRunAt: run.lastRunAt,
        discoveredCount: run.discoveredCount,
        classifiedCount: run.classifiedCount,
        sources: run.sources,
        failure: run.failure,
      },
      update: {
        status: run.status,
        lastRunAt: run.lastRunAt,
        discoveredCount: run.discoveredCount,
        classifiedCount: run.classifiedCount,
        sources: run.sources,
        failure: run.failure,
      },
    });
    return toDiscoveryRun(row);
  }
}

function toDiscoveryRun(row: Prisma.DiscoveryRunGetPayload<Record<string, never>>): DiscoveryRun {
  return {
    campaignId: row.campaignId,
    status: row.status,
    lastRunAt: row.lastRunAt ?? row.createdAt,
    discoveredCount: row.discoveredCount,
    classifiedCount: row.classifiedCount,
    sources: [...row.sources],
    failure: row.failure,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
