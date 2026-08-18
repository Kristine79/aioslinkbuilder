import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createPrismaClient } from '@aios/infrastructure';
import {
  PrismaAuditLogRepository,
  PrismaCampaignRepository,
  PrismaCompanyRepository,
} from '@aios/infrastructure';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeDb = hasDatabase ? describe : describe.skip;

describeDb('prisma repositories', () => {
  it('creates, reads and updates a company', async () => {
    const prisma = createPrismaClient();
    const repository = new PrismaCompanyRepository(prisma);
    let id = '';
    try {
      const created = await repository.create({
        name: 'Integration Test Company',
        description: 'created for repository integration test',
        website: 'https://example.com',
      });
      id = created.id;

      expect(created.name).toBe('Integration Test Company');
      expect(created.geography).toEqual([]);

      const found = await repository.findById(id);
      expect(found).toEqual(created);

      const updated = await repository.update({
        ...created,
        name: 'Integration Test Company (updated)',
        website: null,
      });

      expect(updated.name).toBe('Integration Test Company (updated)');
      expect(updated.website).toBeNull();
      expect(updated.id).toBe(id);

      await expect(repository.findById('missing-company')).resolves.toBeNull();
    } finally {
      await prisma.company.deleteMany({ where: { id } });
      await prisma.$disconnect();
    }
  });

  it('creates, reads and updates campaigns scoped by company', async () => {
    const prisma = createPrismaClient();
    const companyRepository = new PrismaCompanyRepository(prisma);
    const campaignRepository = new PrismaCampaignRepository(prisma);
    let companyId = '';
    let campaignId = '';
    try {
      const company = await companyRepository.create({ name: 'Integration Test Company' });
      companyId = company.id;

      const created = await campaignRepository.create({
        companyId,
        name: 'Integration Test Campaign',
        goals: ['First goal'],
      });
      campaignId = created.id;

      expect(created.status).toBe('DRAFT');

      const byCompany = await campaignRepository.findByCompanyId(companyId);
      expect(byCompany).toEqual([created]);

      const updated = await campaignRepository.update({
        ...created,
        goals: ['First goal', 'Second goal'],
      });

      expect(updated.goals).toEqual(['First goal', 'Second goal']);

      const found = await campaignRepository.findById(campaignId);
      expect(found).toEqual(updated);

      await expect(campaignRepository.findByCompanyId('missing-company')).resolves.toEqual([]);
      await expect(campaignRepository.findById('missing-campaign')).resolves.toBeNull();
    } finally {
      await prisma.campaign.deleteMany({ where: { id: campaignId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
      await prisma.$disconnect();
    }
  });

  it('appends audit log entries', async () => {
    const prisma = createPrismaClient();
    const repository = new PrismaAuditLogRepository(prisma);
    const entityId = `test-entity-${randomUUID()}`;
    try {
      await repository.append({
        actor: 'system',
        action: 'TEST_ACTION',
        entityType: 'Company',
        entityId,
        metadata: null,
      });

      const rows = await prisma.auditLog.findMany({ where: { entityId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actor: 'system',
        action: 'TEST_ACTION',
        entityType: 'Company',
        entityId,
      });
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityId } });
      await prisma.$disconnect();
    }
  });
});
