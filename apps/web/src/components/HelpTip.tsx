/**
 * Contextual help tooltip: a small «?» that reveals a short explanation on
 * hover/focus. Detailed explanations live in the Help Center — the tooltip
 * only points there and never replaces the deeper docs.
 */

import { Link } from 'react-router-dom';

export function HelpTip({
  text,
  align = 'left',
  label = 'Подробнее в справке',
  to = '/help',
}: {
  text: string;
  align?: 'left' | 'right';
  label?: string;
  to?: string;
}) {
  return (
    <span className="help-tip" data-align={align} role="button" tabIndex={0} aria-label={label}>
      <span aria-hidden="true">?</span>
      <span className="help-tip-panel">
        {text} <Link to={to}>Подробнее в Справке →</Link>
      </span>
    </span>
  );
}
