export const PLACEMENT_METHODS = [
  'API',
  'SEMI_AUTOMATED',
  'BROWSER',
  'MANUAL',
  'OUTREACH',
  'UNKNOWN',
] as const;

export type PlacementMethod = (typeof PLACEMENT_METHODS)[number];
