export const EVIDENCE_TYPES = [
  'LIVE_URL',
  'SCREENSHOT',
  'PAGE_CONTENT',
  'COMPANY_MATCH',
  'WEBSITE_MATCH',
  'BACKLINK_MATCH',
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
