import { Prisma } from '@prisma/client';

export function toDomainMetadata(
  value: Prisma.JsonValue | null,
): Readonly<Record<string, unknown>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value;
}

export function toPrismaJson(
  value: Readonly<Record<string, unknown>> | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null) {
    return Prisma.JsonNull;
  }
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  return parsed as Prisma.InputJsonValue;
}
