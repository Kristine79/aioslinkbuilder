/**
 * «Прогресс кампании» — единый pipeline: Найдено → Рекомендовано →
 * Одобрено → Запущено → Опубликовано → Проверено. Hierarchy: the movement
 * through the pipeline is the primary signal (thin connector line + dots),
 * the absolute numbers are secondary. Each stage navigates to its section.
 */

import { Link } from 'react-router-dom';

import type { OverviewDto } from '../api/types';
import { FUNNEL_LABELS } from '../ru';

const FUNNEL_LINKS: Readonly<Record<string, string>> = {
  discovered: '/opportunities',
  recommended: '/opportunities?status=QUALIFIED',
  approved: '/opportunities',
  executed: '/opportunities',
  published: '/opportunities',
  verified: '/activity',
};

export function DashboardProgress({
  funnel,
  goals,
}: {
  funnel: OverviewDto['funnel'];
  goals: string[];
}) {
  if (funnel.length === 0) return null;

  let currentIndex = -1;
  funnel.forEach((step, index) => {
    if (step.count > 0) currentIndex = index;
  });

  return (
    <section className="card card-pad mb-16">
      <div className="flex-between mb-16">
        <div style={{ minWidth: 0 }}>
          <strong>Прогресс кампании</strong>
          <div className="text-secondary" style={{ fontSize: 12.5, marginTop: 2 }}>
            От поиска площадок до проверенных размещений
          </div>
        </div>
        {goals[0] !== undefined && (
          <div className="chip" title={goals[0]}>
            цель: {goals[0]}
          </div>
        )}
      </div>
      <div className="progress">
        {funnel.map((step, index) => {
          const state =
            index === currentIndex ? 'current' : index < currentIndex ? 'done' : 'pending';
          return (
            <Link
              key={step.stage}
              className={`progress-step is-${state}`}
              to={FUNNEL_LINKS[step.stage] ?? '/opportunities'}
            >
              <span className="progress-number">{step.count}</span>
              <span className="progress-label">{FUNNEL_LABELS[step.stage] ?? step.stage}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
