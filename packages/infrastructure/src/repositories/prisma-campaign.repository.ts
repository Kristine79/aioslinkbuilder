import type { PrismaClient, Prisma } from '@prisma/client';
import type { Campaign, CampaignDraft } from '@aios/domain';
import type { CampaignRepository } from '@aios/application';

export class PrismaCampaignRepository implements CampaignRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<Campaign | null> {
    const row = await this.db.campaign.findUnique({ where: { id } });
    return row === null ? null : toCampaign(row);
  }

  async findByCompanyId(companyId: string): Promise<Campaign[]> {
    const rows = await this.db.campaign.findMany({ where: { companyId } });
    return rows.map(toCampaign);
  }

  async create(draft: CampaignDraft): Promise<Campaign> {
    const row = await this.db.campaign.create({
      data: { companyId: draft.companyId, name: draft.name, goals: draft.goals },
    });
    return toCampaign(row);
  }

  async update(campaign: Campaign): Promise<Campaign> {
    const row = await this.db.campaign.update({
      where: { id: campaign.id },
      data: { name: campaign.name, goals: campaign.goals, status: campaign.status },
    });
    return toCampaign(row);
  }
}

function toCampaign(row: Prisma.CampaignGetPayload<Record<string, never>>): Campaign {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    goals: row.goals,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
