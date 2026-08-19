import type { IndexingStatus, MetricDatum } from './donor-quality.js';
import { unknownDatum } from './donor-quality.js';

/**
 * Page-level analysis. A donor domain and a specific placement page are
 * different entities: the domain carries the overall quality profile, the
 * page carries the concrete place where the link would be inserted. A real
 * crawler/page-analysis provider can be connected behind the PageAnalysisProvider
 * port; this model is the neutral representation it fills.
 */

export const PAGE_TYPES = [
  'EDITORIAL',
  'RESOURCE',
  'BLOG',
  'PRODUCT',
  'PROFILE',
  'LISTING',
  'NEWS',
  'CATEGORY',
  'OTHER',
  'UNKNOWN',
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

export interface OutboundLinkSignals {
  total: number | null;
  external: number | null;
  dofollow: number | null;
}

export interface PageAnalysis {
  targetDomain: string;
  targetPage: string | null;
  pageTitle: string | null;
  pageType: PageType;
  topicalRelevance: MetricDatum<number>;
  linkInsertSuitability: MetricDatum<number>;
  indexation: MetricDatum<IndexingStatus>;
  traffic: MetricDatum<number>;
  outboundLinkSignals: MetricDatum<OutboundLinkSignals>;
  /** Where on the page the link should be placed (paragraph, aside, footer…). */
  suggestedPlacementLocation: string | null;
  summary: string | null;
  analyzedAt: string;
}

export function emptyPageAnalysis(targetDomain: string): PageAnalysis {
  return {
    targetDomain,
    targetPage: null,
    pageTitle: null,
    pageType: 'UNKNOWN',
    topicalRelevance: unknownDatum<number>(),
    linkInsertSuitability: unknownDatum<number>(),
    indexation: unknownDatum<IndexingStatus>(),
    traffic: unknownDatum<number>(),
    outboundLinkSignals: unknownDatum<OutboundLinkSignals>(),
    suggestedPlacementLocation: null,
    summary: null,
    analyzedAt: new Date().toISOString(),
  };
}
