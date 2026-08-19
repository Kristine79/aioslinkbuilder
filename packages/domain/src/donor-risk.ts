import type { DonorQualityProfile } from './donor-quality.js';
import { isKnownDatum } from './donor-quality.js';

/**
 * Donor risk / spam analysis. Deterministic assessment built from available
 * signals of the donor quality profile. Unknown signals are never treated as
 * evidence: a signal only fires when its data is actually available.
 */

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_SIGNAL_KINDS = [
  'suspicious_traffic',
  'irrelevant_topics',
  'excessive_outbound_links',
  'pbn_signals',
  'low_quality_content',
  'poor_indexation',
  'suspicious_backlinks',
  'traffic_mismatch',
  'overly_commercial',
  'link_selling',
] as const;

export type RiskSignalKind = (typeof RISK_SIGNAL_KINDS)[number];

export const RISK_SIGNAL_LABELS: Readonly<Record<RiskSignalKind, string>> = {
  suspicious_traffic: 'подозрительные паттерны трафика',
  irrelevant_topics: 'низкая тематическая релевантность',
  excessive_outbound_links: 'подозрительно высокий объём исходящих ссылок',
  pbn_signals: 'признаки PBN',
  low_quality_content: 'низкокачественный контент',
  poor_indexation: 'слабая индексация страниц',
  suspicious_backlinks: 'подозрительный ссылочный профиль',
  traffic_mismatch: 'несоответствие заявленного и фактического трафика',
  overly_commercial: 'чрезмерно коммерческая страница',
  link_selling: 'признаки продажи ссылок',
};

export interface RiskSignal {
  kind: RiskSignalKind;
  severity: 1 | 2 | 3;
  available: boolean;
}

export interface DonorRiskAssessment {
  level: RiskLevel;
  signals: readonly RiskSignal[];
  /** Human-readable reasons (Russian) for the active signals. */
  reasons: string[];
  /** Optional AI-provided context; never replaces deterministic reasons. */
  aiReasons: string[];
  assessedAt: string;
}

/**
 * Deterministic risk assessment. Only known signals participate. Returns an
 * explicit set of active signals with severities plus the derived level:
 * 0 -> LOW, 1-2 -> MEDIUM, 3+ -> HIGH, nothing known -> UNKNOWN.
 */
export function assessDonorRisk(
  profile: DonorQualityProfile,
  context: { companyGeography?: string[] } = {},
): DonorRiskAssessment {
  const signals: RiskSignal[] = [];
  const reasons: string[] = [];

  const push = (kind: RiskSignalKind, severity: 1 | 2 | 3, reason: string): void => {
    signals.push({ kind, severity, available: true });
    reasons.push(reason);
  };

  if (isKnownDatum(profile.spamRisk) && typeof profile.spamRisk.value === 'number') {
    const value = profile.spamRisk.value;
    if (value >= 60) push('link_selling', 3, RISK_SIGNAL_LABELS.link_selling);
    else if (value >= 35) push('link_selling', 2, RISK_SIGNAL_LABELS.link_selling);
  }

  if (isKnownDatum(profile.topicalRelevance) && typeof profile.topicalRelevance.value === 'number') {
    if (profile.topicalRelevance.value < 45) {
      push('irrelevant_topics', 2, RISK_SIGNAL_LABELS.irrelevant_topics);
    } else if (profile.topicalRelevance.value < 60) {
      push('irrelevant_topics', 1, RISK_SIGNAL_LABELS.irrelevant_topics);
    }
  }

  if (isKnownDatum(profile.indexingStatus)) {
    const status = profile.indexingStatus.value;
    if (status === 'NOT_INDEXED') {
      push('poor_indexation', 3, RISK_SIGNAL_LABELS.poor_indexation);
    } else if (status === 'PARTIAL') {
      push('poor_indexation', 1, RISK_SIGNAL_LABELS.poor_indexation);
    }
  }

  if (
    isKnownDatum(profile.organicTraffic) &&
    typeof profile.organicTraffic.value === 'number' &&
    profile.organicTraffic.value === 0 &&
    isKnownDatum(profile.authority) &&
    typeof profile.authority.value === 'number' &&
    profile.authority.value >= 40
  ) {
    push(
      'traffic_mismatch',
      2,
      'высокая авторитетность при нулевом органическом трафике — признаки искусственного трафика',
    );
  }

  if (isKnownDatum(profile.trafficGeography) && context.companyGeography !== undefined) {
    const geos = (profile.trafficGeography.value ?? []).map((value) => value.toLowerCase());
    const companyGeos = context.companyGeography.map((value) => value.toLowerCase());
    const hasOverlap = companyGeos.some((geo) => geos.some((trafficGeo) => trafficGeo.includes(geo)));
    if (companyGeos.length > 0 && !hasOverlap) {
      push(
        'irrelevant_topics',
        1,
        'география трафика донора не пересекается с регионом компании',
      );
    }
  }

  const severitySum = signals.reduce((sum, signal) => sum + signal.severity, 0);
  const level: RiskLevel =
    signals.length === 0 ? 'UNKNOWN' : severitySum >= 3 ? 'HIGH' : severitySum >= 2 ? 'MEDIUM' : 'LOW';

  return {
    level,
    signals,
    reasons,
    aiReasons: [],
    assessedAt: new Date().toISOString(),
  };
}

export function riskToScore(level: RiskLevel): number {
  switch (level) {
    case 'LOW':
      return 90;
    case 'MEDIUM':
      return 60;
    case 'HIGH':
      return 30;
    case 'UNKNOWN':
      return 50;
  }
}
