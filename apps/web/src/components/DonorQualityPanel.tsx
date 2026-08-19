/**
 * «Качество донора» — donor quality profile with visual indicators and
 * explicit data provenance (measured / AI estimate / synthetic / unknown).
 */

import type { DonorQualityDto, MetricDatumDto } from '../api/types';
import {
  DONOR_QUALITY_LEVEL_LABELS,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_TONES,
} from '../ru';
import { formatMetricValue } from './Metric';

function toneFor(score: number | null): string {
  if (score === null) return 'tone-gray';
  if (score >= 80) return 'tone-green';
  if (score >= 65) return 'tone-teal';
  if (score >= 50) return 'tone-amber';
  return 'tone-red';
}

function MetricRow({
  label,
  datum,
  format,
}: {
  label: string;
  datum: MetricDatumDto<number>;
  format?: (v: number) => string;
}) {
  const value = datum.value;
  const displayed =
    value === null ? '—' : (format ? format(value) : new Intl.NumberFormat('ru-RU').format(value));
  const known = datum.status !== 'UNKNOWN';
  return (
    <div className="donor-row">
      <span className="donor-label">{label}</span>
      <span className={`donor-value ${known ? '' : 'muted'}`} title={datum.source ?? ''}>
        {displayed}
      </span>
      <span className="donor-status">
        <span className={`badge ${datum.status === 'MEASURED' ? 'tone-green' : datum.status === 'AI_ESTIMATED' ? 'tone-blue' : datum.status === 'SYNTHETIC' ? 'tone-amber' : datum.status === 'UNKNOWN' ? 'tone-gray' : 'tone-indigo'}`}>
          {datum.status === 'MEASURED'
            ? 'измерено'
            : datum.status === 'AI_ESTIMATED'
              ? 'оценка AI'
              : datum.status === 'SYNTHETIC'
                ? 'демо'
                : datum.status === 'INTERNAL'
                  ? 'расчёт'
                  : 'нет данных'}
        </span>
      </span>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${value}%` }} />
      </span>
      <span className="bar-value">{value}</span>
    </div>
  );
}

export function DonorQualityPanel({ donor, riskLevel }: { donor: DonorQualityDto; riskLevel?: string | null }) {
  const overall = donor.overallDonorQuality;
  return (
    <div>
      <div className="flex-between mb-8">
        <div className="flex" style={{ gap: 8, alignItems: 'center' }}>
          <span className="score-value" style={{ color: toneFor(overall) }}>
            {overall === null ? '—' : overall}
          </span>
          <span className="text-secondary" style={{ fontSize: 13 }}>
            {DONOR_QUALITY_LEVEL_LABELS[donor.overallLevel] ?? donor.overallLevel}
          </span>
        </div>
        {riskLevel !== null && riskLevel !== undefined && riskLevel !== 'UNKNOWN' && (
          <span className={`badge ${RISK_LEVEL_TONES[riskLevel] ?? 'tone-gray'}`}>
            риск: {RISK_LEVEL_LABELS[riskLevel] ?? riskLevel}
          </span>
        )}
      </div>

      <div className="donor-grid">
        <div className="donor-metrics">
          <MetricRow label="Авторитетность" datum={donor.authority} />
          <MetricRow label="Орг. трафик" datum={donor.organicTraffic} />
          <MetricRow label="Реальный трафик (оценка)" datum={donor.estimatedRealTraffic} />
          <MetricRow label="Spam-риск" datum={donor.spamRisk} />
          <MetricRow label="Тематика" datum={donor.topicalRelevance} />
          <MetricRow label="Аудитория" datum={donor.audienceMatch} />
          <MetricRow label="География" datum={donor.geographicRelevance} />
          <MetricRow label="Качество размещения" datum={donor.placementQuality} />
          <MetricRow label="Автоматизация" datum={donor.automationPotential} />
        </div>
        <div className="donor-aside">
          <ScoreBar label="Тематика" value={donor.topicalRelevance.value} />
          <ScoreBar label="Аудитория" value={donor.audienceMatch.value} />
          <ScoreBar label="География" value={donor.geographicRelevance.value} />
          {donor.indexingStatus.value !== null && (
            <div className="donor-row">
              <span className="donor-label">Индексация</span>
              <span className={`donor-value ${donor.indexingStatus.status === 'UNKNOWN' ? 'muted' : ''}`}>
                {donor.indexingStatus.value === 'INDEXED'
                  ? 'проиндексирована'
                  : donor.indexingStatus.value === 'PARTIAL'
                    ? 'частично'
                    : 'не проиндексирована'}
              </span>
            </div>
          )}
          {donor.trafficGeography.value !== null && donor.trafficGeography.value.length > 0 && (
            <div className="donor-row">
              <span className="donor-label">География трафика</span>
              <span className="donor-value">{formatMetricValue(donor.trafficGeography.value)}</span>
            </div>
          )}
          {donor.keywordProfile.value !== null && donor.keywordProfile.value.length > 0 && (
            <div className="donor-row">
              <span className="donor-label">Ядро запросов</span>
              <span className="donor-value donor-clamp">{formatMetricValue(donor.keywordProfile.value)}</span>
            </div>
          )}
          {donor.backlinkProfile.value !== null && (
            <div className="donor-row">
              <span className="donor-label">Суб-профиля</span>
              <span className="donor-value">
                {donor.backlinkProfile.value.referringDomains ?? '—'} доренов
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
