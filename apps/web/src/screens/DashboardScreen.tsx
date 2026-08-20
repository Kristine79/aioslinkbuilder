/**
 * Обзор — операционный командный центр кампании.
 *
 * Иерархия экрана отвечает на пять вопросов пользователя:
 * 1. «Что это за система?» — hero с брендом;
 * 2. «Где находится моя кампания?» — интерактивный workflow-стрип
 *    DISCOVER → QUALIFY → CREATE → OUTREACH → NEGOTIATE → PLACE → VERIFY
 *    со счётчиками по этапам;
 * 3. «Что мне делать сейчас?» — блок «Следующий шаг» с CTA, выводимый из
 *    реального состояния кампании;
 * 4. «Что требует моего участия?» — блок «Требует действия» на базе
 *    humanActions + ожидающих ответа переговоров;
 * 5. «Что уже произошло?» — прогресс кампании и последние события.
 *
 * Все числа и действия приходят из /api/overview и /api/opportunities;
 * фронтенд ничего не вычисляет и не выдумывает.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import type { OpportunityDto, OverviewDto } from '../api/types';
import { DashboardActions } from '../components/DashboardActions';
import { DashboardEvents } from '../components/DashboardEvents';
import { DashboardProgress } from '../components/DashboardProgress';
import { Alert, ErrorState, LoadingState, StatusBadge } from '../components/ui';
import { WorkflowDiagram, type WorkflowStepStatus } from '../components/WorkflowDiagram';
import { pluralRu } from '../ru';

interface NextStep {
  key: string;
  title: string;
  description: string;
  cta: string;
  to?: string;
  anchor?: string;
  tone: 'accent' | 'amber' | 'blue';
}

/**
 * Глобальный следующий шаг кампании — детерминированная приоритизация
 * на основе данных обзора. Никакой бизнес-логики: только презентационный
 * выбор CTA по текущему состоянию.
 */
function nextStepFor(overview: OverviewDto): NextStep {
  const { counts, humanActions } = overview;

  if (humanActions.length > 0) {
    return {
      key: 'actions',
      title: 'Требуется ваше решение',
      description: `${humanActions.length} ${pluralRu(
        humanActions.length,
        'действие ждёт',
        'действия ждут',
        'действий ждут',
      )} вашего участия.`,
      cta: 'Перейти к действиям',
      anchor: 'dashboard-actions',
      tone: 'amber',
    };
  }

  if (counts.opportunities === 0) {
    return {
      key: 'discover',
      title: 'Найти площадки',
      description: 'AI проанализирует кампанию и найдёт подходящие возможности для размещения.',
      cta: 'Найти площадки',
      to: '/opportunities',
      tone: 'accent',
    };
  }

  if (counts.recommended > 0) {
    return {
      key: 'recommendations',
      title: 'Проверить рекомендации',
      description: `${counts.recommended} ${pluralRu(
        counts.recommended,
        'площадка получила',
        'площадки получили',
        'площадок получили',
      )} статус «Рекомендовано».`,
      cta: 'Открыть рекомендации',
      to: '/opportunities?status=QUALIFIED',
      tone: 'blue',
    };
  }

  if (counts.ready > 0) {
    return {
      key: 'launch',
      title: 'Запустить размещение',
      description: `${counts.ready} ${pluralRu(
        counts.ready,
        'возможность готова',
        'возможности готовы',
        'возможностей готовы',
      )} к запуску.`,
      cta: 'К запуску',
      to: '/opportunities?status=READY',
      tone: 'blue',
    };
  }

  if (counts.approved > 0) {
    return {
      key: 'approved',
      title: 'Продолжить с одобренными',
      description: `${counts.approved} ${pluralRu(
        counts.approved,
        'возможность прошла',
        'возможности прошли',
        'возможностей прошли',
      )} одобрение — осталось настроить размещение.`,
      cta: 'К возможностям',
      to: '/opportunities',
      tone: 'blue',
    };
  }

  if (counts.executed > 0 || counts.published > 0) {
    return {
      key: 'verify',
      title: 'Проверить размещения',
      description: 'Размещения отправлены — подтвердите результат проверкой.',
      cta: 'Открыть проверки',
      to: '/activity',
      tone: 'blue',
    };
  }

  if (counts.verified > 0) {
    return {
      key: 'expand',
      title: 'Расширить кампанию',
      description: `${counts.verified} ${pluralRu(
        counts.verified,
        'размещение проверено',
        'размещения проверены',
        'размещений проверено',
      )} — начните новый поиск площадок.`,
      cta: 'Искать площадки',
      to: '/opportunities',
      tone: 'accent',
    };
  }

  return {
    key: 'evaluate',
    title: 'Оценить возможности',
    description: `${counts.opportunities} ${pluralRu(
      counts.opportunities,
      'возможность ждёт',
      'возможности ждут',
      'возможностей ждут',
    )} оценки и рекомендаций.`,
    cta: 'Оценить',
    to: '/opportunities',
    tone: 'blue',
  };
}

/** Связывает этапы продукта со счётчиками обзора; null — данных нет. */
function buildWorkflowStatuses(overview: OverviewDto): WorkflowStepStatus[] {
  const { counts, negotiations } = overview;
  const rows: Array<{ count: number | null; countText?: string; to: string }> = [
    { count: counts.opportunities, countText: 'найдено', to: '/opportunities' },
    {
      count: counts.recommended,
      countText: 'рекомендовано',
      to: '/opportunities?status=QUALIFIED',
    },
    { count: counts.approved, countText: 'одобрено', to: '/opportunities' },
    { count: null, to: '/opportunities' },
    { count: negotiations.length, countText: 'в переговорах', to: '/opportunities' },
    { count: counts.executed, countText: 'запущено', to: '/opportunities' },
    { count: counts.verified, countText: 'проверено', to: '/activity' },
  ];

  let currentIndex = -1;
  rows.forEach((row, index) => {
    if ((row.count ?? 0) > 0) currentIndex = index;
  });

  return rows.map((row, index) => ({
    count: row.count,
    ...(row.countText !== undefined ? { countText: row.countText } : {}),
    to: row.to,
    state: index === currentIndex ? 'current' : index < currentIndex ? 'done' : 'pending',
  }));
}

/** Статусы, которые ещё требуют внимания (показываются в «Приоритетных возможностях»). */
const ACTIONABLE_STATUSES: ReadonlySet<string> = new Set([
  'QUALIFIED',
  'SELECTED',
  'READY',
  'SUBMITTED',
  'PENDING_PUBLICATION',
  'PUBLISHED',
  'NEEDS_MANUAL',
]);

function NextStepBanner({ next }: { next: NextStep }) {
  const scrollToActions = () => {
    document
      .getElementById('dashboard-actions')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const cta =
    next.anchor !== undefined ? (
      <button className="btn btn-primary" type="button" onClick={scrollToActions}>
        {next.cta}
      </button>
    ) : (
      <Link className="btn btn-primary" to={next.to ?? '/opportunities'}>
        {next.cta}
      </Link>
    );

  return (
    <section className={`next-step next-step-${next.tone} card mb-16`}>
      <div className="next-step-main">
        <div className="next-step-label">Следующий шаг</div>
        <div className="next-step-title">{next.title}</div>
        <div className="next-step-text">{next.description}</div>
      </div>
      {cta}
    </section>
  );
}

export function DashboardScreen() {
  const [overview, setOverview] = useState<OverviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<OpportunityDto[] | null>(null);

  const load = useCallback(() => {
    setError(null);
    setOverview(null);
    setItems(null);
    api
      .overview()
      .then(setOverview)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    api
      .opportunities({ sort: 'score' })
      .then((result) => setItems(result.items))
      .catch(() => setItems(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const opportunityById = useMemo(() => {
    const map = new Map<string, OpportunityDto>();
    for (const opportunity of items ?? []) map.set(opportunity.id, opportunity);
    return map;
  }, [items]);

  const workflowStatuses = useMemo(
    () => (overview === null ? [] : buildWorkflowStatuses(overview)),
    [overview],
  );
  const nextStep = useMemo(() => (overview === null ? null : nextStepFor(overview)), [overview]);
  const topOpportunities = useMemo(
    () => (items ?? []).filter((item) => ACTIONABLE_STATUSES.has(item.status)).slice(0, 4),
    [items],
  );

  if (overview === null && error === null) {
    return <LoadingState text="Загружаем обзор…" />;
  }
  if (overview === null) {
    return <ErrorState message={error ?? 'Неизвестная ошибка'} onRetry={load} />;
  }

  const { counts, funnel, recentActivity, campaign, company } = overview;

  return (
    <div>
      <section className="hero card mb-16">
        <div className="hero-top">
          <div>
            <div className="hero-brand">AI Backlink OS</div>
            <div className="hero-tagline">
              Платформа для поиска, оценки и получения качественных backlink-размещений с помощью
              AI.
            </div>
          </div>
          <Link to="/help" className="btn btn-secondary btn-sm">
            Как это работает?
          </Link>
        </div>
        <div className="mt-16">
          <WorkflowDiagram statuses={workflowStatuses} />
        </div>
      </section>

      <h1 className="page-title">Обзор кампании</h1>
      <p className="page-subtitle truncate">
        {company.name} · {campaign.name}
      </p>

      {nextStep !== null && <NextStepBanner next={nextStep} />}

      <DashboardActions overview={overview} opportunityById={opportunityById} />

      <DashboardProgress funnel={funnel} goals={campaign.goals} />

      <div className="grid grid-2 mt-16">
        <section className="card">
          <div className="card-header">
            <div className="card-title" style={{ flex: 1 }}>
              Приоритетные возможности
            </div>
            <Link to="/opportunities" className="text-secondary" style={{ fontSize: 12.5 }}>
              Все возможности
            </Link>
          </div>
          <div className="card-body">
            {items === null ? (
              <div className="dash-inline-empty">
                <div className="dash-empty-title">Список недоступен</div>
                <div className="dash-empty-hint">
                  Не удалось загрузить приоритетные возможности.
                </div>
                <Link className="btn btn-secondary btn-sm mt-8" to="/opportunities">
                  Открыть список
                </Link>
              </div>
            ) : items.length === 0 ? (
              <div className="dash-inline-empty">
                <div className="dash-empty-title">Пока нет найденных возможностей</div>
                <div className="dash-empty-hint">
                  Запустите поиск площадок, чтобы система нашла подходящих доноров.
                </div>
                <Link className="btn btn-primary btn-sm mt-8" to="/opportunities">
                  Найти площадки
                </Link>
              </div>
            ) : topOpportunities.length === 0 ? (
              <div className="dash-inline-empty">
                <div className="dash-empty-title">Все возможности обработаны</div>
                <div className="dash-empty-hint">
                  Результаты и доказательства — на экране «Активность и доказательства».
                </div>
              </div>
            ) : (
              <div className="opp-list">
                {topOpportunities.map((opportunity) => (
                  <div className="opp-row" key={opportunity.id}>
                    <div className="opp-main">
                      <Link className="opp-name" to={`/opportunities/${opportunity.id}`}>
                        {opportunity.platformName}
                      </Link>
                      <div className="opp-meta">
                        <StatusBadge status={opportunity.status} />
                        {opportunity.categoryName !== null && (
                          <span>{opportunity.categoryName}</span>
                        )}
                      </div>
                    </div>
                    <span className="opp-score">{opportunity.score ?? '—'}</span>
                    <Link
                      className="btn btn-secondary btn-sm"
                      to={`/opportunities/${opportunity.id}`}
                    >
                      Открыть
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <DashboardEvents events={recentActivity} opportunityById={opportunityById} />
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
