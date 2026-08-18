/**
 * Обзор: campaign progress funnel, key counters, manual actions and the
 * recent activity feed. All numbers come from /api/overview.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import type { OverviewDto } from '../api/types';
import { Alert, ErrorState, LoadingState, StatCard } from '../components/ui';
import { AUDIT_ACTION_LABELS, FUNNEL_LABELS, formatDateTime } from '../ru';

export function DashboardScreen() {
  const [overview, setOverview] = useState<OverviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setOverview(null);
    api
      .overview()
      .then(setOverview)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (overview === null && error === null) {
    return <LoadingState text="Загружаем обзор…" />;
  }
  if (overview === null) {
    return <ErrorState message={error ?? 'Неизвестная ошибка'} onRetry={load} />;
  }

  const { counts, funnel, manualActions, recentActivity, campaign, company } = overview;
  const activeFunnel = funnel
    .slice()
    .reverse()
    .find((step) => step.count > 0)?.stage;

  return (
    <div>
      <h1 className="page-title">Обзор кампании</h1>
      <p className="page-subtitle">
        {company.name} · {campaign.name}
      </p>

      <div className="mt-16 card card-pad">
        <div className="flex-between mb-16">
          <div>
            <strong>Прогресс кампании</strong>
            <div className="text-secondary" style={{ fontSize: 12.5, marginTop: 2 }}>
              От поиска площадок до проверенных размещений
            </div>
          </div>
          <div className="chip">цель: {(campaign.goals[0] ?? '').slice(0, 60)}…</div>
        </div>
        <div className="funnel">
          {funnel.map((step) => (
            <div
              key={step.stage}
              className={`funnel-step ${step.stage === activeFunnel ? 'active' : ''}`}
            >
              <div className="funnel-count">{step.count}</div>
              <div className="funnel-label">{FUNNEL_LABELS[step.stage] ?? step.stage}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="stat-grid mt-16">
        <StatCard
          value={counts.opportunities}
          label="Найдено возможностей"
          hint="площадки под размещение"
          link={{ to: '/opportunities', text: 'Открыть список' }}
        />
        <StatCard
          value={counts.recommended}
          label="Рекомендовано"
          hint="AI рекомендовал, нужно одобрить"
          link={{ to: '/opportunities?status=QUALIFIED', text: 'К рекомендациям' }}
        />
        <StatCard
          value={counts.approved}
          label="Одобрено"
          hint="готово к запуску или уже в работе"
          link={{ to: '/opportunities?status=SELECTED', text: 'Одобренные' }}
        />
        <StatCard
          value={counts.ready}
          label="Готово к запуску"
          hint="включая повтор после ошибки"
          link={{ to: '/opportunities?status=READY', text: 'К запуску' }}
        />
        <StatCard
          value={counts.executed}
          label="Запущено"
          hint="размещение отправлено на площадку"
          link={{ to: '/opportunities', text: 'Все размещения' }}
        />
        <StatCard
          value={counts.published}
          label="Опубликовано"
          hint="подтверждено площадкой"
          link={{ to: '/opportunities', text: 'Список' }}
        />
        <StatCard
          value={counts.verified}
          label="Проверено"
          hint="результат подтверждён доказательствами"
          link={{ to: '/activity', text: 'Доказательства' }}
        />
        <StatCard
          value={counts.failed}
          label="С ошибками"
          hint="можно повторить попытку"
          link={{ to: '/opportunities?status=READY', text: 'К повторам' }}
        />
        <StatCard
          value={counts.manual}
          label="Требуется ручная работа"
          hint="выполните действие и подтвердите"
          link={{ to: '/opportunities?status=NEEDS_MANUAL', text: 'К действиям' }}
        />
      </div>

      <div className="grid grid-2 mt-16">
        <section className="card">
          <div className="card-header">
            <div className="card-title" style={{ flex: 1 }}>
              Ручные действия
            </div>
            {manualActions.length > 0 && (
              <span className="badge tone-amber">{manualActions.length}</span>
            )}
          </div>
          <div className="card-body">
            {manualActions.length === 0 ? (
              <div className="empty-note">Ручных действий нет.</div>
            ) : (
              <div className="list">
                {manualActions.map((action) => (
                  <div className="row" key={action.placementId}>
                    <div className="row-main">
                      <div className="row-title">{action.platformName}</div>
                      <div className="row-sub">
                        <span>{action.reason}</span>
                      </div>
                    </div>
                    <Link
                      className="btn btn-secondary btn-sm"
                      to={`/opportunities/${action.opportunityId}`}
                    >
                      Открыть
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div className="card-title" style={{ flex: 1 }}>
              Последние события
            </div>
            <Link to="/activity" className="text-secondary" style={{ fontSize: 12.5 }}>
              Весь журнал
            </Link>
          </div>
          <div className="card-body">
            {recentActivity.length === 0 ? (
              <div className="empty-note">Событий пока нет.</div>
            ) : (
              <div className="audit-list">
                {recentActivity.slice(0, 8).map((entry) => (
                  <div className="audit-row" key={entry.id}>
                    <span className="audit-time">{formatDateTime(entry.timestamp)}</span>
                    <span className="audit-action">
                      {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                    <span className="audit-meta mono">{entry.entityId}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {counts.failed > 0 && (
        <div className="mt-16">
          <Alert tone="info">
            Размещения с ошибками ждут повтора. Откройте возможность и нажмите «Запустить» — будет
            создана новая попытка, старая останется в журнале.
          </Alert>
        </div>
      )}
    </div>
  );
}
