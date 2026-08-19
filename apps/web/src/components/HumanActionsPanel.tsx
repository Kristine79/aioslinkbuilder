/**
 * «Требует действия» — human-in-the-loop action cards. Each card explains
 * WHY the human is needed, WHAT the AI prepared and WHAT the human must do.
 */

import { Link } from 'react-router-dom';

import type { HumanActionDto } from '../api/types';
import { HUMAN_ACTION_LABELS } from '../ru';

export function HumanActionCard({ action }: { action: HumanActionDto }) {
  return (
    <div className="hitl-card">
      <div className="flex-between">
        <span className="hitl-kind">{HUMAN_ACTION_LABELS[action.kind] ?? action.kind}</span>
        <Link to={`/opportunities/${action.opportunityId}`} className="btn btn-secondary btn-sm">
          {action.actionLabel}
        </Link>
      </div>
      <div className="hitl-title">{action.title}</div>
      <div className="hitl-row">
        <span className="hitl-hint">Почему</span>
        <span>{action.why}</span>
      </div>
      <div className="hitl-row">
        <span className="hitl-hint">AI подготовил</span>
        <span>{action.aiPrepared}</span>
      </div>
      <div className="hitl-row">
        <span className="hitl-hint">Что нужно сделать</span>
        <span>{action.humanTask}</span>
      </div>
    </div>
  );
}

export function HumanActionsPanel({ actions }: { actions: HumanActionDto[] }) {
  if (actions.length === 0) {
    return <div className="empty-note">Действий, требующих вас, сейчас нет.</div>;
  }
  return (
    <div className="hitl-grid">
      {actions.map((action) => (
        <HumanActionCard key={action.id} action={action} />
      ))}
    </div>
  );
}
