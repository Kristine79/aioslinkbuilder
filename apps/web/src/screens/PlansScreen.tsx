/**
 * План размещений (AI Placement Decision Engine) — campaign-level plan:
 * every discovered opportunity gets exactly one decision bucket, derived by
 * the backend from the deterministic score/risk/provider state and the
 * reconciled AI suggestions. The UI only renders the backend decision map —
 * no business logic here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import type { PlanItemDto, PlacementPlanDto } from '../api/types';
import { ErrorState, LoadingState } from '../components/ui';
import {
  METHOD_LABELS,
  PLAN_AUTOMATION_LABELS,
  PLAN_NEXT_ACTION_LABELS,
  PLAN_RECOMMENDATION_LABELS,
  PLAN_REJECTION_LABELS,
  RISK_LEVEL_LABELS,
  TYPE_LABELS,
  formatDateTime,
} from '../ru';

export function PlansScreen() {
  const [plan, setPlan] = useState<PlacementPlanDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api
      .getPlacementPlan()
      .then((result) => setPlan(result))
      .catch((err: unknown) => {
        if (err instanceof Error && (err as { code?: string }).code === 'NO_PLACEMENT_PLAN') {
          setPlan(null);
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = () => {
    setLoading(true);
    setError(null);
    api
      .placementPlan()
      .then((result) => {
        setPlan(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  };

  const sections = useMemo(() => {
    const items = plan?.items ?? [];
    const byRecommendation = (recommendation: PlanItemDto['recommendation']) =>
      items.filter((item) => item.recommendation === recommendation);
    return {
      recommended: byRecommendation('RECOMMENDED'),
      review: byRecommendation('REVIEW_REQUIRED'),
      notRecommended: byRecommendation('NOT_RECOMMENDED'),
      insufficient: byRecommendation('INSUFFICIENT_DATA'),
    };
  }, [plan]);

  if (error !== null) {
    return <ErrorState message={error} onRetry={load} />;
  }
  if (loading && plan === null) {
    return <LoadingState text="Формируем план…" />;
  }
  if (plan === null) {
    return (
      <div>
        <h1 className="page-title">План размещений</h1>
        <p className="page-subtitle">
          AI-движок решений: каждая найденная возможность получает вердикт и следующий шаг на основе
          оценки, риска и доступных провайдеров.
        </p>
        <button className="btn btn-primary" type="button" onClick={generate} disabled={loading}>
          {loading ? 'Формируем план…' : 'Сформировать план'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 className="page-title">План размещений</h1>
          <p className="page-subtitle">
            Сформирован {formatDateTime(plan.generatedAt)} · {plan.provider} · AI интерпретирует
            данные, итоговые решения проверяет детерминированная логика.
          </p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={generate} disabled={loading}>
          {loading ? 'Формируем…' : 'Обновить план'}
        </button>
      </div>

      <div className="stat-grid">
        <PlanCountCard
          label={PLAN_RECOMMENDATION_LABELS.RECOMMENDED}
          count={plan.summary.recommended}
          tone="tone-green"
        />
        <PlanCountCard
          label={PLAN_RECOMMENDATION_LABELS.REVIEW_REQUIRED}
          count={plan.summary.reviewRequired}
          tone="tone-amber"
        />
        <PlanCountCard
          label={PLAN_RECOMMENDATION_LABELS.NOT_RECOMMENDED}
          count={plan.summary.notRecommended}
          tone="tone-red"
        />
        <PlanCountCard
          label={PLAN_RECOMMENDATION_LABELS.INSUFFICIENT_DATA}
          count={plan.summary.insufficientData}
          tone="tone-gray"
        />
        <PlanCountCard
          label="Автоматизация"
          count={plan.summary.automationPercent}
          suffix="%"
          tone="tone-indigo"
        />
      </div>

      {plan.recommendedToStart.length > 0 && (
        <div className="card mt-16">
          <div className="card-header">
            <div className="card-title">С чего начать</div>
          </div>
          <div className="card-body">
            <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
              {plan.recommendedToStart.map((item) => (
                <span key={item.opportunityId} className="badge">
                  <Link to={`/opportunities/${item.opportunityId}`}>{item.platformName}</Link>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {sections.recommended.length > 0 && (
        <PlanSection
          title={`${PLAN_RECOMMENDATION_LABELS.RECOMMENDED} (${sections.recommended.length})`}
          items={sections.recommended}
        />
      )}
      {sections.review.length > 0 && (
        <PlanSection
          title={`${PLAN_RECOMMENDATION_LABELS.REVIEW_REQUIRED} (${sections.review.length})`}
          items={sections.review}
        />
      )}
      {sections.insufficient.length > 0 && (
        <PlanSection
          title={`${PLAN_RECOMMENDATION_LABELS.INSUFFICIENT_DATA} (${sections.insufficient.length})`}
          items={sections.insufficient}
        />
      )}
      {sections.notRecommended.length > 0 && (
        <PlanSection
          title={`${PLAN_RECOMMENDATION_LABELS.NOT_RECOMMENDED} (${sections.notRecommended.length})`}
          items={sections.notRecommended}
        />
      )}
    </div>
  );
}

function PlanCountCard({
  label,
  count,
  tone,
  suffix = '',
}: {
  label: string;
  count: number;
  tone: string;
  suffix?: string;
}) {
  return (
    <div className="stat">
      <div className={`stat-value ${tone}`}>
        {count}
        {suffix}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function PlanSection({ title, items }: { title: string; items: PlanItemDto[] }) {
  return (
    <div className="card mt-16">
      <div className="card-header">
        <div className="card-title">{title}</div>
      </div>
      <div className="card-body">
        <div className="table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Площадка</th>
                <th>Тип / метод</th>
                <th>Оценка</th>
                <th>Риск</th>
                <th>Решение</th>
                <th>Следующий шаг</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <PlanRow key={item.opportunityId} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlanRow({ item }: { item: PlanItemDto }) {
  const risk =
    item.riskLevel === null ? null : (RISK_LEVEL_LABELS[item.riskLevel] ?? item.riskLevel);
  return (
    <tr>
      <td>
        <Link to={`/opportunities/${item.opportunityId}`}>{item.platformName}</Link>
        <div className="text-tertiary" style={{ fontSize: 12 }}>
          {item.recommendationReason}
        </div>
        {item.rejectionReason !== null && (
          <div className="text-tertiary" style={{ fontSize: 12 }}>
            <span className="tone-red">
              {PLAN_REJECTION_LABELS[item.rejectionReason.kind] ?? item.rejectionReason.kind}:
            </span>{' '}
            {item.rejectionReason.text}
          </div>
        )}
        {item.anchorRecommendation !== null && (
          <div className="text-tertiary" style={{ fontSize: 12 }}>
            Анкор: «{item.anchorRecommendation.anchor}» ({item.anchorRecommendation.anchorType}) —{' '}
            {item.anchorRecommendation.explanation}
          </div>
        )}
        {item.riskExplanation !== null && (
          <div className="text-tertiary" style={{ fontSize: 12 }}>
            {item.riskExplanation}
          </div>
        )}
        {item.suggestedPlacementApproach !== null && (
          <div className="text-tertiary" style={{ fontSize: 12 }}>
            {item.suggestedPlacementApproach}
          </div>
        )}
      </td>
      <td>
        {TYPE_LABELS[item.placementType] ?? item.placementType}
        <div className="text-tertiary" style={{ fontSize: 12 }}>
          {METHOD_LABELS[item.placementMethod] ?? item.placementMethod}
        </div>
      </td>
      <td>
        {item.overallScore !== null
          ? `${item.overallScore}`
          : item.score !== null
            ? `${item.score}`
            : '—'}
        <div className="text-tertiary" style={{ fontSize: 12 }}>
          {item.donorQuality !== null ? `донор ${item.donorQuality}` : ''}
        </div>
      </td>
      <td>{risk ?? '—'}</td>
      <td>
        <span className="badge tone-gray">{PLAN_RECOMMENDATION_LABELS[item.recommendation]}</span>
      </td>
      <td>
        {PLAN_NEXT_ACTION_LABELS[item.nextAction] ?? item.nextAction}
        <div className="text-tertiary" style={{ fontSize: 12 }}>
          {PLAN_AUTOMATION_LABELS[item.automationLevel] ?? item.automationLevel}
        </div>
      </td>
    </tr>
  );
}
