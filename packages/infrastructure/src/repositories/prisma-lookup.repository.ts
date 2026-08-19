import type { Prisma, PrismaClient } from '@prisma/client';
import type { PlacementCategory, PlacementProvider, Platform } from '@aios/domain';
import type { LookupRepository } from '@aios/application';

import { toDomainCapabilities, toDomainMetadata, toPrismaJson } from './mappers.js';

type PlatformRow = Prisma.PlatformGetPayload<Record<string, never>>;

export class PrismaLookupRepository implements LookupRepository {
  constructor(private readonly db: PrismaClient) {}

  async listCategories(): Promise<PlacementCategory[]> {
    const rows = await this.db.placementCategory.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      sortOrder: row.sortOrder,
    }));
  }

  async listPlatforms(): Promise<Platform[]> {
    const rows = await this.db.platform.findMany({ orderBy: { name: 'asc' } });
    return rows.map(toDomainPlatform);
  }

  async listProviders(): Promise<PlacementProvider[]> {
    const rows = await this.db.placementProvider.findMany({ orderBy: { name: 'asc' } });
    return rows.map((row) => ({
      id: row.id,
      platformId: row.platformId,
      name: row.name,
      providerType: row.providerType,
      capabilities: toDomainCapabilities(row.capabilities),
      capabilitiesVerified: row.capabilitiesVerified,
      notes: row.notes,
    }));
  }

  async createPlatform(platform: Platform): Promise<Platform> {
    if (platform.url !== null) {
      const existing = await this.db.platform.findFirst({
        where: { url: platform.url },
      });
      if (existing !== null) {
        return toDomainPlatform(existing);
      }
    } else {
      const existing = await this.db.platform.findFirst({
        where: { name: platform.name, url: null },
      });
      if (existing !== null) {
        return toDomainPlatform(existing);
      }
    }
    const created = await this.db.platform.create({
      data: {
        id: platform.id,
        name: platform.name,
        url: platform.url,
        country: platform.country,
        categoryId: platform.categoryId,
        notes: platform.notes,
        metadata: toPrismaJson(platform.metadata),
      },
    });
    return toDomainPlatform(created);
  }
}

function toDomainPlatform(row: PlatformRow): Platform {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    country: row.country,
    categoryId: row.categoryId,
    notes: row.notes,
    metadata: toDomainMetadata(row.metadata),
  };
}
