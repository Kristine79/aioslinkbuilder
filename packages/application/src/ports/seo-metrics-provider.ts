import type {
  BacklinkProfile,
  IndexingStatus,
  MetricDatum,
} from '@aios/domain';

/**
 * SEO metrics provider port.
 *
 * Real implementations connect Ahrefs / Semrush / Similarweb / Google Search
 * Console and return MEASURED data with the source named. Until credentials
 * exist, a mock returns SYNTHETIC data and the status field keeps the
 * distinction explicit — the UI must never present synthetic values as real
 * measurements.
 */
export interface SeoMetricsSnapshot {
  platformName: string;
  url: string | null;
  organicTraffic: MetricDatum<number>;
  trafficGeography: MetricDatum<string[]>;
  keywordProfile: MetricDatum<string[]>;
  backlinkProfile: MetricDatum<BacklinkProfile>;
  /** DR / DA or equivalent authority metric, 0-100. */
  authority: MetricDatum<number>;
  /** Spam risk score, 0-100. */
  spamRisk: MetricDatum<number>;
  indexingStatus: MetricDatum<IndexingStatus>;
  estimatedRealTraffic: MetricDatum<number>;
  fetchedAt: string;
}

export interface SeoMetricsProvider {
  readonly name: string;
  fetchDonorProfile(input: {
    platformName: string;
    url: string | null;
  }): Promise<SeoMetricsSnapshot>;
}
