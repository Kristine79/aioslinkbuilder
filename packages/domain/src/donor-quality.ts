import { ValidationError } from './errors.js';

/**
 * Donor quality profile.
 *
 * Every external metric carries explicit provenance: where the number came
 * from (source), whether it is a real measurement, an AI estimate, an
 * internal/deterministic value, demo (synthetic) data, or unknown. The UI
 * must never present synthetic or unknown metrics as real measurements.
 */

export const METRIC_STATUSES = [
  'MEASURED', // measured by a real external tool (Ahrefs, Semrush, …)
  'AI_ESTIMATED', // estimated by AI from available context
  'INTERNAL', // derived deterministically inside the system
  'SYNTHETIC', // demo/mock data, never real
  'UNKNOWN', // not available
] as const;

export type MetricStatus = (typeof METRIC_STATUSES)[number];

export interface MetricDatum<T> {
  value: T | null;
  source: string | null;
  status: MetricStatus;
  /** 0-100; meaningful for AI_ESTIMATED values. */
  confidence: number | null;
  /** ISO timestamp of the measurement, when available. */
  measuredAt: string | null;
}

export function isKnownDatum<T>(datum: MetricDatum<T>): boolean {
  return datum.status !== 'UNKNOWN' && datum.value !== null;
}

export function unknownDatum<T>(): MetricDatum<T> {
  return { value: null, source: null, status: 'UNKNOWN', confidence: null, measuredAt: null };
}

export function syntheticDatum<T>(value: T, source = 'demo'): MetricDatum<T> {
  return {
    value,
    source,
    status: 'SYNTHETIC',
    confidence: null,
    measuredAt: null,
  };
}

export type IndexingStatus = 'INDEXED' | 'PARTIAL' | 'NOT_INDEXED';

export interface BacklinkProfile {
  referringDomains: number | null;
  totalBacklinks: number | null;
  dofollowRatio: number | null;
}

export interface DonorQualityProfile {
  organicTraffic: MetricDatum<number>;
  trafficGeography: MetricDatum<string[]>;
  keywordProfile: MetricDatum<string[]>;
  backlinkProfile: MetricDatum<BacklinkProfile>;
  /** DR / DA or equivalent authority metric, 0-100. */
  authority: MetricDatum<number>;
  /** Spam risk score, 0-100 (higher = riskier). */
  spamRisk: MetricDatum<number>;
  indexingStatus: MetricDatum<IndexingStatus>;
  estimatedRealTraffic: MetricDatum<number>;
  topicalRelevance: MetricDatum<number>;
  audienceMatch: MetricDatum<number>;
  geographicRelevance: MetricDatum<number>;
  placementQuality: MetricDatum<number>;
  automationPotential: MetricDatum<number>;
  /** Deterministic overall score 0-100 (see calculateDonorQuality). */
  overallDonorQuality: number | null;
  overallLevel: DonorQualityLevel;
}

export const DONOR_QUALITY_LEVELS = [
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'POOR',
  'UNKNOWN',
] as const;

export type DonorQualityLevel = (typeof DONOR_QUALITY_LEVELS)[number];

export const DONOR_QUALITY_DIMENSIONS = [
  'topicalRelevance',
  'audienceMatch',
  'geographicRelevance',
  'authority',
  'organicTraffic',
  'estimatedRealTraffic',
  'backlinkProfile',
  'placementQuality',
  'automationPotential',
] as const;

export type DonorQualityDimension = (typeof DONOR_QUALITY_DIMENSIONS)[number];

/**
 * Weights of the donor quality dimensions (documented in SCORING.md).
 * Only dimensions whose status is not UNKNOWN participate in the average;
 * weights are re-normalized over the known set.
 */
export const DONOR_QUALITY_DIMENSION_WEIGHTS: Readonly<
  Record<DonorQualityDimension, number>
> = {
  topicalRelevance: 20,
  audienceMatch: 15,
  geographicRelevance: 10,
  authority: 20,
  organicTraffic: 10,
  estimatedRealTraffic: 5,
  backlinkProfile: 10,
  placementQuality: 5,
  automationPotential: 5,
};

export function emptyDonorQualityProfile(): DonorQualityProfile {
  return {
    organicTraffic: unknownDatum<number>(),
    trafficGeography: unknownDatum<string[]>(),
    keywordProfile: unknownDatum<string[]>(),
    backlinkProfile: unknownDatum<BacklinkProfile>(),
    authority: unknownDatum<number>(),
    spamRisk: unknownDatum<number>(),
    indexingStatus: unknownDatum<IndexingStatus>(),
    estimatedRealTraffic: unknownDatum<number>(),
    topicalRelevance: unknownDatum<number>(),
    audienceMatch: unknownDatum<number>(),
    geographicRelevance: unknownDatum<number>(),
    placementQuality: unknownDatum<number>(),
    automationPotential: unknownDatum<number>(),
    overallDonorQuality: null,
    overallLevel: 'UNKNOWN',
  };
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/** Normalizes an organic-traffic count to a 0-100 scale (diminishing returns). */
function trafficToScore(traffic: number): number {
  if (traffic <= 0) return 0;
  return clamp(Math.round(100 * (1 - 1 / (1 + traffic / 50_000))));
}

/** Backlink profile sub-score on a 0-100 scale (logarithmic on domain count). */
function backlinkSubScore(profile: BacklinkProfile | null): number | null {
  if (profile === null) return null;
  const domains = profile.referringDomains;
  if (domains === null || domains < 0) return null;
  if (domains === 0) return 0;
  return clamp(Math.round(40 * Math.log10(1 + domains)));
}

/**
 * Deterministic donor quality score.
 *
 * The overall score is the weighted average of all known (non-UNKNOWN)
 * dimensions, re-normalized over the known weights. Unknown dimensions are
 * neither rewarded nor penalized. The result is deterministic and is the
 * only place a donor quality number is produced.
 */
export function calculateDonorQuality(profile: DonorQualityProfile): {
  overallDonorQuality: number | null;
  overallLevel: DonorQualityLevel;
} {
  const contributions: Array<{ weight: number; value: number }> = [];
  const push = (
    weightKey: keyof typeof DONOR_QUALITY_DIMENSION_WEIGHTS,
    datum: MetricDatum<number>,
    transform?: (raw: number) => number,
  ): void => {
    if (!isKnownDatum(datum) || typeof datum.value !== 'number') return;
    contributions.push({
      weight: DONOR_QUALITY_DIMENSION_WEIGHTS[weightKey],
      value: clamp(transform === undefined ? datum.value : transform(datum.value)),
    });
  };

  push('topicalRelevance', profile.topicalRelevance);
  push('audienceMatch', profile.audienceMatch);
  push('geographicRelevance', profile.geographicRelevance);
  push('authority', profile.authority);
  push('organicTraffic', profile.organicTraffic, trafficToScore);
  push('estimatedRealTraffic', profile.estimatedRealTraffic, trafficToScore);
  if (isKnownDatum(profile.backlinkProfile)) {
    const subScore = backlinkSubScore(profile.backlinkProfile.value);
    if (subScore !== null) {
      contributions.push({ weight: DONOR_QUALITY_DIMENSION_WEIGHTS.backlinkProfile, value: subScore });
    }
  }
  push('placementQuality', profile.placementQuality);
  push('automationPotential', profile.automationPotential);

  const totalWeight = contributions.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return { overallDonorQuality: null, overallLevel: 'UNKNOWN' };
  }
  const overall = Math.round(
    contributions.reduce((sum, entry) => sum + entry.weight * entry.value, 0) / totalWeight,
  );
  return { overallDonorQuality: overall, overallLevel: levelFor(overall) };
}

export function levelFor(score: number): DonorQualityLevel {
  if (score >= 80) return 'EXCELLENT';
  if (score >= 65) return 'GOOD';
  if (score >= 50) return 'FAIR';
  return 'POOR';
}

export function validateDonorQualityProfile(profile: DonorQualityProfile): void {
  const numeric: Array<MetricDatum<number>> = [
    profile.organicTraffic,
    profile.authority,
    profile.spamRisk,
    profile.estimatedRealTraffic,
    profile.topicalRelevance,
    profile.audienceMatch,
    profile.geographicRelevance,
    profile.placementQuality,
    profile.automationPotential,
  ];
  for (const datum of numeric) {
    if (
      datum.status !== 'UNKNOWN' &&
      datum.status !== 'MEASURED' &&
      datum.status !== 'AI_ESTIMATED' &&
      datum.status !== 'INTERNAL' &&
      datum.status !== 'SYNTHETIC'
    ) {
      throw new ValidationError(`Donor quality metric status must be one of: ${METRIC_STATUSES.join(', ')}`);
    }
    if (datum.value !== null && typeof datum.value !== 'number') {
      throw new ValidationError('Donor quality numeric metric value must be a number');
    }
  }
}
