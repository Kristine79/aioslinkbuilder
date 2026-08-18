import type { PrismaClient } from '@prisma/client';
import type { PlacementCategory, PlacementProvider, Platform } from '@aios/domain';
import type { LookupRepository } from '@aios/application';

import { toDomainCapabilities, toDomainMetadata } from './mappers.js';

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
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      country: row.country,
      categoryId: row.categoryId,
      notes: row.notes,
      metadata: toDomainMetadata(row.metadata),
    }));
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
}
