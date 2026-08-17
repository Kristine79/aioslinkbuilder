export const PROVIDER_CAPABILITIES = [
  'DISCOVER',
  'VALIDATE',
  'CREATE',
  'UPDATE',
  'GET_STATUS',
  'VERIFY',
] as const;

export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];
