import { describe, expect, it } from 'vitest';

import { createPrismaClient } from '@aios/infrastructure';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeDb = hasDatabase ? describe : describe.skip;

describeDb('database connectivity', () => {
  it('connects to PostgreSQL and executes a query', async () => {
    const prisma = createPrismaClient();
    try {
      const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
      expect(result[0]?.ok).toBe(1);
    } finally {
      await prisma.$disconnect();
    }
  });
});