export const PROVIDER_TYPES = ['API', 'BROWSER', 'MANUAL', 'MOCK'] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];
