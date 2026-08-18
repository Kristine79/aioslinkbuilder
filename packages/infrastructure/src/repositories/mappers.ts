import { Prisma } from '@prisma/client';
import { PROVIDER_CAPABILITIES } from '@aios/domain';
import type { ProviderCapability } from '@aios/domain';

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

export function toDomainCapabilities(value: Prisma.JsonValue): ProviderCapability[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (capability): capability is ProviderCapability =>
      typeof capability === 'string' &&
      PROVIDER_CAPABILITIES.includes(capability as ProviderCapability),
  );
}
