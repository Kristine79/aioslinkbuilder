/**
 * Score display: big value + weighted dimension breakdown.
 * The breakdown comes from the backend (domain scoring is the source of truth).
 */

import type { ScoreBreakdownDto } from '../api/types';
import { SCORE_DIMENSION_LABELS } from '../ru';

const DIMENSIONS = [
  'topicalRelevance',
  'audienceMatch',
  'geographicRelevance',
  'authority',
  'placementQuality',
  'automationPotential',
] as const;

function scoreTone(score: number): string {
  if (score >= 85) return 'var(--green)';
  if (score >= 70) return 'var(--teal)';
  if (score >= 55) return 'var(--amber)';
  return 'var(--gray)';
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-tertiary">—</span>;
  }
  return (
    <span style={{ color: scoreTone(score) }} className="score-value">
      {score}
    </span>
  );
}

export function ScoreBreakdown({ breakdown }: { breakdown: ScoreBreakdownDto | null }) {
  if (breakdown === null) {
    return <div className="empty-note">Оценка ещё не рассчитана.</div>;
  }
  return (
    <div className="flex" style={{ flexDirection: 'column', gap: 8 }}>
      {DIMENSIONS.map((dimension) => {
        const value = breakdown[dimension];
        return (
          <div className="bar-row" key={dimension}>
            <span className="bar-label">{SCORE_DIMENSION_LABELS[dimension]}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${value}%` }} />
            </span>
            <span className="bar-value">{value}</span>
          </div>
        );
      })}
    </div>
  );
}
