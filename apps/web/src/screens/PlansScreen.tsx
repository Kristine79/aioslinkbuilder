/**
 * План размещений (AI Placement Decision Engine) — campaign-level plan:
 * every discovered opportunity gets exactly one decision bucket, derived by
 * the backend from the deterministic score/risk/provider state and the
 * reconciled AI suggestions. The UI only renders the backend decision map.
 *
 * The screen distinguishes four states:
 * — план формируется (loading);
 * — план пуст (нет возможностей);
 * — план сформирован и содержит данные;
 * — ошибка (с повтором).
 * The automation metric is only shown as a percentage when the plan actually
 * has enough data to compute it; otherwise it reads «—».
 *
 * Each plan item carries its selected provider type (providerType) directly
 * from the backend, so no extra opportunities lookup is needed to render
 * the «Демо» marker for MOCK providers.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import type { PlanItemDto, PlanRecommendation, PlacementPlanDto } from '../api/types';
import { useDiscoveryState } from '../discoveryState';
import {
  METHOD_LABELS,
  PLAN_AUTOMATION_LABELS,
  PLAN_NEXT_ACTION_LABELS,
  PLAN_RECOMMENDATION_LABELS,
  PLAN_REJECTION_LABELS,
  PROVIDER_TYPE_LABELS,
  RISK_LEVEL_LABELS,
  TYPE_LABELS,
  formatDateTime,
} from '../ru';

type VerdictFilter = 'ALL' | PlanRecommendation;

interface PlanErrorInfo {
  code: string | null;
  message: string;
}

const PLAN_STEPS = ['Анализируем возможности', 'оцениваем риски', 'определяем приоритеты'];

export function PlansScreen() {
  const [plan, setPlan] = useState<PlacementPlanDto | null>(null);
  const [error, setError] = useState<PlanErrorInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('ALL');
  const { hasRun: discoveryHasRan, refresh: refreshDiscovery } = useDiscoveryState();

  const load = useCallback(() => {
    setError(null);
    refreshDiscovery();
    api
      .getPlacementPlan()
      .then((result) => {
        setPlan(result);
      })
      .catch((err: unknown) => {
        const code = err instanceof Error ? ((err as { code?: string }).code ?? null) : null;
        if (code === 'NO_PLACEMENT_PLAN') {
          setPlan(null);
          return;
        }
        if (code === 'NO_ANALYSIS') {
          setError({
            code: 'NO_ANALYSIS',
            message: err instanceof Error ? err.message : String(err),
          });
          return;
        }
        setError({ code: 'LOAD', message: err instanceof Error ? err.message : String(err) });
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .placementPlan()
      .then((result) => {
        setPlan(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const code = err instanceof Error ? ((err as { code?: string }).code ?? null) : null;
        setError({ code, message: err instanceof Error ? err.message : String(err) });
        setLoading(false);
      });
  }, []);

  const regenerate = useCallback(() => {
    setReloading(true);
    setError(null);
    api
      .placementPlan()
      .then((result) => {
        setPlan(result);
        setReloading(false);
      })
      .catch((err: unknown) => {
        const code = err instanceof Error ? ((err as { code?: string }).code ?? null) : null;
        setError({ code, message: err instanceof Error ? err.message : String(err) });
        setReloading(false);
      });
  }, []);

  const automaticCount = useMemo(
    () => (plan?.items ?? []).filter((item) => item.automationLevel === 'AUTOMATIC').length,
    [plan],
  );
  const aiAssistedCount = useMemo(
    () => (plan?.items ?? []).filter((item) => item.automationLevel === 'AI_ASSISTED').length,
    [plan],
  );
  const humanRequiredCount = useMemo(
    () => (plan?.items ?? []).filter((item) => item.automationLevel === 'HUMAN_REQUIRED').length,
    [plan],
  );

  if (error !== null) {
    if (error.code === 'NO_ANALYSIS') {
      return (
        <div>
          <h1 className="page-title">План размещений</h1>
          <p className="page-subtitle">AI-движок решений для найденных возможностей.</p>
          <div className="state-box">
            <div className="state-box-icon">◈</div>
            <div className="state-box-title">Сначала выполните анализ компании</div>
            <div className="state-box-hint">
              План строится на данных AI-анализа и найденных возможностей. Запустите анализ
              компании, затем найдите площадки.
            </div>
            <div className="state-actions">
              <Link className="btn btn-primary mt-16" to="/company">
                Перейти к анализу →
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div>
        <h1 className="page-title">План размещений</h1>
        <p className="page-subtitle">AI-движок решений для найденных возможностей.</p>
        <div className="state-box">
          <div className="state-box-icon">⚠</div>
          <div className="state-box-title">Не удалось сформировать план</div>
          <div className="state-box-hint">{error.message}</div>
          <div className="state-actions">
            <button
              className="btn btn-primary mt-16"
              type="button"
              onClick={generate}
              disabled={loading}
            >
              Повторить
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && plan === null) {
    return (
      <div>
        <h1 className="page-title">План размещений</h1>
        <p className="page-subtitle">AI-движок решений для найденных возможностей.</p>
        <div className="state-box">
          <div className="spinner" />
          <div className="state-box-title">Формируем план…</div>
          <div className="state-box-hint">{PLAN_STEPS.join(' → ')}</div>
        </div>
      </div>
    );
  }

  if (plan === null || plan.items.length === 0) {
    return (
      <div>
        <h1 className="page-title">План размещений</h1>
        <p className="page-subtitle">AI-движок решений для найденных возможностей.</p>
        <div className="state-box">
          <div className="state-box-icon">◌</div>
          <div className="state-box-title">
            {discoveryHasRan ? 'План размещений пока пуст' : 'План ещё не сформирован'}
          </div>
          <div className="state-box-hint">
            {discoveryHasRan
              ? 'Поиск площадок уже выполнен, но новых возможностей пока нет. Измените стратегию или повторите поиск.'
              : 'Сначала найдите площадки и оцените возможности. После этого AI OS сформирует приоритетный план размещений.'}
          </div>
          <div className="state-actions">
            <Link className="btn btn-primary mt-16" to="/opportunities?discover=1">
              {discoveryHasRan ? 'Повторить поиск' : 'Найти площадки →'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const total = plan.summary.total;

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 className="page-title">План размещений</h1>
          {reloading ? (
            <p className="page-subtitle">Обновляем план…</p>
          ) : (
            <p className="page-subtitle">
              Сформирован {formatDateTime(plan.generatedAt)}
              <span className="provenance ml-8">
                <span className="provenance-primary">{plan.provider}</span>
              </span>
            </p>
          )}
          <p className="text-tertiary" style={{ fontSize: 12 }}>
            AI подготовил рекомендации, итоговые решения проверены правилами системы.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={regenerate}
          disabled={reloading}
        >
          {reloading ? 'Формируем…' : 'Обновить план'}
        </button>
      </div>

      {reloading && plan !== null && (
        <div className="alert alert-info mb-16">
          Обновляем план: {PLAN_STEPS.join(' → ')}… Текущий план остаётся доступным.
        </div>
      )}

      <div className="stat-grid">
        <VerdictFilterCard
          label={PLAN_RECOMMENDATION_LABELS.RECOMMENDED}
          count={plan.summary.recommended}
          tone="tone-green"
          active={verdictFilter === 'RECOMMENDED'}
          onClick={() =>
            setVerdictFilter((current) => (current === 'RECOMMENDED' ? 'ALL' : 'RECOMMENDED'))
          }
        />
        <VerdictFilterCard
          label={PLAN_RECOMMENDATION_LABELS.REVIEW_REQUIRED}
          count={plan.summary.reviewRequired}
          tone="tone-amber"
          active={verdictFilter === 'REVIEW_REQUIRED'}
          onClick={() =>
            setVerdictFilter((current) =>
              current === 'REVIEW_REQUIRED' ? 'ALL' : 'REVIEW_REQUIRED',
            )
          }
        />
        <VerdictFilterCard
          label={PLAN_RECOMMENDATION_LABELS.NOT_RECOMMENDED}
          count={plan.summary.notRecommended}
          tone="tone-red"
          active={verdictFilter === 'NOT_RECOMMENDED'}
          onClick={() =>
            setVerdictFilter((current) =>
              current === 'NOT_RECOMMENDED' ? 'ALL' : 'NOT_RECOMMENDED',
            )
          }
        />
        <VerdictFilterCard
          label={PLAN_RECOMMENDATION_LABELS.INSUFFICIENT_DATA}
          count={plan.summary.insufficientData}
          tone="tone-gray"
          active={verdictFilter === 'INSUFFICIENT_DATA'}
          onClick={() =>
            setVerdictFilter((current) =>
              current === 'INSUFFICIENT_DATA' ? 'ALL' : 'INSUFFICIENT_DATA',
            )
          }
        />
        <div className="stat card-verdict card-verdict-plain">
          <div className="stat-value tone-indigo">
            {total > 0 ? `${plan.summary.automationPercent}%` : '—'}
          </div>
          <div className="stat-label">Потенциал автоматизации</div>
          <div className="stat-hint">
            {total > 0
              ? `Полностью автоматически: ${automaticCount} из ${total}. С участием AI: ${aiAssistedCount} · требует человека: ${humanRequiredCount}.`
              : 'нет данных для расчёта'}
          </div>
        </div>
      </div>

      {verdictFilter !== 'ALL' && (
        <div className="mt-16" style={{ fontSize: 12.5 }}>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => setVerdictFilter('ALL')}
          >
            Показать все вердикты
          </button>
        </div>
      )}

      {plan.recommendedToStart.length > 0 && verdictFilter === 'ALL' && (
        <div className="card mt-16">
          <div className="card-header">
            <div className="card-title">С чего начать</div>
          </div>
          <div className="card-body">
            <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
              {plan.recommendedToStart.map((item) => (
                <span key={item.opportunityId} className="badge tone-accent">
                  <Link to={`/opportunities/${item.opportunityId}`}>{item.platformName}</Link>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-16">
        <h2 className="section-title">
          {verdictFilter === 'ALL'
            ? 'Приоритетные размещения'
            : PLAN_RECOMMENDATION_LABELS[verdictFilter]}
        </h2>
        <div className="list">
          {plan.items
            .filter((item) => verdictFilter === 'ALL' || item.recommendation === verdictFilter)
            .map((item) => (
              <PlanItemCard
                key={item.opportunityId}
                item={item}
                isMock={item.providerType === 'MOCK'}
              />
            ))}
        </div>
      </div>

      {verdictFilter === 'ALL' && (
        <div className="text-tertiary mt-16" style={{ fontSize: 12 }}>
          Нажмите на карточку с вердиктом, чтобы отфильтровать план по нему.
        </div>
      )}
    </div>
  );
}

function VerdictFilterCard({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`stat card-verdict ${active ? 'card-verdict-active' : ''}`}
      type="button"
      onClick={onClick}
    >
      <span className={`stat-value ${tone}`}>{count}</span>
      <span className="stat-label">{label}</span>
    </button>
  );
}

function PlanItemCard({ item, isMock }: { item: PlanItemDto; isMock: boolean }) {
  const risk =
    item.riskLevel === null ? null : (RISK_LEVEL_LABELS[item.riskLevel] ?? item.riskLevel);
  const score = item.overallScore ?? item.score;
  const recommendationTone =
    item.recommendation === 'RECOMMENDED'
      ? 'tone-green'
      : item.recommendation === 'REVIEW_REQUIRED'
        ? 'tone-amber'
        : item.recommendation === 'NOT_RECOMMENDED'
          ? 'tone-red'
          : 'tone-gray';

  return (
    <div className="row plan-item-row">
      <div className="row-main">
        <div className="row-title">
          <Link to={`/opportunities/${item.opportunityId}`}>{item.platformName}</Link>
          <span className={`badge ${recommendationTone}`}>
            {PLAN_RECOMMENDATION_LABELS[item.recommendation]}
          </span>
          {isMock && <span className="chip chip-demo">Демо</span>}
        </div>
        <div className="row-sub">
          <span>{TYPE_LABELS[item.placementType] ?? item.placementType}</span>
          <span className="chip">
            {METHOD_LABELS[item.placementMethod] ?? item.placementMethod}
          </span>
          {item.donorQuality !== null && (
            <span className="chip">донор {item.donorQuality} / 100</span>
          )}
          {risk !== null && <span className="chip">риск: {risk}</span>}
          {isMock && (
            <span className="text-tertiary" style={{ fontSize: 12 }}>
              {PROVIDER_TYPE_LABELS.MOCK}
            </span>
          )}
        </div>
        <div className="plan-item-why">
          <div className="plan-item-why-label">Почему</div>
          <div>{item.recommendationReason}</div>
        </div>
        {item.suggestedPlacementApproach !== null && (
          <div className="plan-item-why">
            <div className="plan-item-why-label">Что делать дальше</div>
            <div>{item.suggestedPlacementApproach}</div>
          </div>
        )}
        {item.rejectionReason !== null && (
          <div className="plan-item-why plan-item-why-rejected">
            <div className="plan-item-why-label">Причина отклонения</div>
            <div>
              {PLAN_REJECTION_LABELS[item.rejectionReason.kind] ?? item.rejectionReason.kind}:{' '}
              {item.rejectionReason.text}
            </div>
          </div>
        )}
        {item.anchorRecommendation !== null && (
          <div className="plan-item-why">
            <div className="plan-item-why-label">Рекомендуемый анкор</div>
            <div>
              «{item.anchorRecommendation.anchor}» ({item.anchorRecommendation.anchorType}) —{' '}
              {item.anchorRecommendation.explanation}
            </div>
          </div>
        )}
        {item.riskExplanation !== null && (
          <div className="plan-item-why">
            <div className="plan-item-why-label">Риск</div>
            <div>{item.riskExplanation}</div>
          </div>
        )}
        <div className="row-actions">
          <span className="chip">
            Следующий шаг: {PLAN_NEXT_ACTION_LABELS[item.nextAction] ?? item.nextAction}
          </span>
          <span className="chip">
            {PLAN_AUTOMATION_LABELS[item.automationLevel] ?? item.automationLevel}
          </span>
        </div>
      </div>
      <div className="row-side">
        <div className="score-value">{score ?? '—'}</div>
        <span className="score-caption">оценка</span>
      </div>
    </div>
  );
}
