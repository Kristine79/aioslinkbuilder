/**
 * «Требует действия» — dashboard block. Real operational items assembled
 * from the overview payload: deterministic HITL actions (humanActions) plus
 * negotiations waiting for a reply that are not yet covered by an HITL item.
 * Priority is presentation-only ordering — the set of actions itself always
 * comes from the backend.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { OpportunityDto, OverviewDto } from '../api/types';
import { NEGOTIATION_INTENT_LABELS, PRIORITY_LABELS } from '../ru';

export interface DashboardActionItem {
  id: string;
  priority: 'HIGH' | 'MEDIUM';
  title: string;
  sub: string | null;
  actionLabel: string;
  opportunityId: string;
}

/** Deterministic presentation ordering for HITL kinds. */
const HITL_PRIORITY: Readonly<Record<string, 'HIGH' | 'MEDIUM'>> = {
  REVIEW_DONOR: 'HIGH',
  MANUAL_PLACEMENT: 'HIGH',
  NEGOTIATE_PRICE: 'HIGH',
  APPROVE_OPPORTUNITY: 'MEDIUM',
  APPROVE_OUTREACH: 'MEDIUM',
  DONOR_REPLIED: 'MEDIUM',
  CONFIRM_PUBLICATION: 'MEDIUM',
};

/** Negotiation intents that still need a human decision. */
const ACTIONABLE_INTENTS: ReadonlySet<string> = new Set([
  'PRICE_NEGOTIATION',
  'CONTENT_REQUIREMENTS',
  'LINK_ATTRIBUTE_REQUEST',
  'NEEDS_CLARIFICATION',
  'MANUAL_REVIEW',
]);

function priorityRank(item: DashboardActionItem): number {
  return item.priority === 'HIGH' ? 0 : 1;
}

export function buildActionItems(
  overview: OverviewDto,
  opportunityById: Map<string, OpportunityDto>,
): DashboardActionItem[] {
  const items: DashboardActionItem[] = [];
  const covered = new Set<string>();

  for (const action of overview.humanActions) {
    const opportunity = opportunityById.get(action.opportunityId);
    const context = [
      opportunity?.platformName ?? null,
      opportunity !== undefined && opportunity.score !== null ? `балл ${opportunity.score}` : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' · ');
    items.push({
      id: action.id,
      priority: HITL_PRIORITY[action.kind] ?? 'MEDIUM',
      title: action.title,
      sub: context !== '' ? context : action.humanTask,
      actionLabel: action.actionLabel,
      opportunityId: action.opportunityId,
    });
    covered.add(action.opportunityId);
  }

  for (const negotiation of overview.negotiations) {
    if (covered.has(negotiation.opportunityId)) continue;
    const intent = negotiation.negotiationIntent;
    if (intent === null || !ACTIONABLE_INTENTS.has(intent)) continue;
    items.push({
      id: `negotiation-${negotiation.opportunityId}`,
      priority: 'MEDIUM',
      title: 'Ответить на переговоры',
      sub: `${negotiation.platformName} · ${NEGOTIATION_INTENT_LABELS[intent] ?? intent}`,
      actionLabel: 'Открыть',
      opportunityId: negotiation.opportunityId,
    });
    covered.add(negotiation.opportunityId);
  }

  return [...items].sort((a, b) => priorityRank(a) - priorityRank(b));
}

export function DashboardActions({
  overview,
  opportunityById,
}: {
  overview: OverviewDto;
  opportunityById: Map<string, OpportunityDto>;
}) {
  const items = useMemo(
    () => buildActionItems(overview, opportunityById),
    [overview, opportunityById],
  );
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 8);

  return (
    <section id="dashboard-actions" className="card mb-16">
      <div className="card-header">
        <div className="card-title" style={{ flex: 1 }}>
          Требует действия
        </div>
        {items.length > 0 && <span className="badge tone-amber">{items.length}</span>}
      </div>
      <div className="card-body">
        {items.length === 0 ? (
          <div className="dash-empty">
            <span className="dash-empty-icon">✓</span>
            <div>
              <div className="dash-empty-title">Всё под контролем</div>
              <div className="dash-empty-hint">Сейчас нет действий, требующих вашего участия.</div>
            </div>
          </div>
        ) : (
          <div className="dash-action-list">
            {visible.map((item) => (
              <div className="dash-action" key={item.id}>
                <span className={`badge ${item.priority === 'HIGH' ? 'tone-red' : 'tone-amber'}`}>
                  {PRIORITY_LABELS[item.priority] ?? item.priority}
                </span>
                <div className="dash-action-main">
                  <div className="dash-action-title">{item.title}</div>
                  {item.sub !== null && <div className="dash-action-sub">{item.sub}</div>}
                </div>
                <Link
                  className="btn btn-secondary btn-sm dash-action-cta"
                  to={`/opportunities/${item.opportunityId}`}
                >
                  {item.actionLabel}
                </Link>
              </div>
            ))}
            {items.length > 8 && (
              <button
                type="button"
                className="btn btn-sm btn-ghost dash-action-more"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? 'Свернуть' : `Показать все (${items.length})`}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
