import 'dotenv/config';

import { createPrismaClient } from '@aios/infrastructure';

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl !== undefined) {
  const prisma = createPrismaClient();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 10_000);
  } catch (error) {
    const host = new URL(databaseUrl).hostname;
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Neon database is unreachable (host: ${host}). Integration tests cannot run. ` +
        `Underlying error: ${cause}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`connection timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
