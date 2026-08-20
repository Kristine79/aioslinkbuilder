/**
 * Visual product workflow: DISCOVER → QUALIFY → CREATE → OUTREACH →
 * NEGOTIATE → PLACE → VERIFY.
 *
 * Presentation only — stage names are the product's public workflow
 * terminology; the captions are UI copy in Russian. Two renderings:
 *
 * - decorative (no `statuses`): the classic strip used by the Help Center
 *   (`detailed` shows the full captions, otherwise compact);
 * - operational (with `statuses`): the dashboard lifecycle strip, where
 *   every stage shows its real count (when the backend has one), its state
 *   (done / current / pending) and navigates to the matching section.
 */

import { Fragment } from 'react';
import { Link } from 'react-router-dom';

export interface WorkflowStep {
  name: string;
  caption: string;
  captionShort: string;
}

export const LIFECYCLE_STEPS: readonly WorkflowStep[] = [
  {
    name: 'DISCOVER',
    caption: 'Поиск потенциальных площадок и страниц: каталог категорий и веб-поиск.',
    captionShort: 'Поиск площадок',
  },
  {
    name: 'QUALIFY',
    caption: 'Детерминированный scoring и AI-оценка релевантности, донора, рисков и пригодности.',
    captionShort: 'Оценка доноров',
  },
  {
    name: 'CREATE',
    caption: 'Подготовка конкретного варианта размещения: тип, анкор и текст link insert.',
    captionShort: 'Подготовка размещения',
  },
  {
    name: 'OUTREACH',
    caption:
      'AI формирует персональное письмо владельцу площадки — человек проверяет и отправляет.',
    captionShort: 'Коммуникация',
  },
  {
    name: 'NEGOTIATE',
    caption: 'Ответ донора анализируется: намерение, стратегия и предлагаемый ответ.',
    captionShort: 'Переговоры',
  },
  {
    name: 'PLACE',
    caption: 'Запуск размещения через провайдера или вручную, если требуется человек.',
    captionShort: 'Размещение',
  },
  {
    name: 'VERIFY',
    caption: 'Проверка результата и сохранение доказательств (URL, содержимое, скриншот).',
    captionShort: 'Проверка',
  },
];

export interface WorkflowStepStatus {
  /** Real count for the stage; null when the backend has no data for it. */
  count: number | null;
  /** Words the count, e.g. «найдено». */
  countText?: string;
  /** The section the stage links to. */
  to?: string;
  state: 'done' | 'current' | 'pending';
}

export function WorkflowDiagram({
  detailed = false,
  compact = false,
  statuses,
  className = '',
}: {
  detailed?: boolean;
  compact?: boolean;
  statuses?: readonly WorkflowStepStatus[];
  className?: string;
}) {
  if (statuses !== undefined) {
    return (
      <div className={`wf wf-strip ${className}`}>
        {LIFECYCLE_STEPS.map((step, index) => {
          const status = statuses[index];
          const content = (
            <Fragment>
              <span className="wf-num">{index + 1}</span>
              <span className="wf-label">{step.name}</span>
              <span className="wf-caption-short">{step.captionShort}</span>
              {status !== undefined && status.count !== null && (
                <span className="wf-count">
                  <span className="wf-count-value">{status.count}</span>
                  {status.countText !== undefined && (
                    <span className="wf-count-text">{status.countText}</span>
                  )}
                </span>
              )}
            </Fragment>
          );
          const stepClass = `wf-step ${status !== undefined ? `is-${status.state}` : ''}`.trim();
          return (
            <Fragment key={step.name}>
              {status !== undefined && status.to !== undefined ? (
                <Link className={stepClass} to={status.to}>
                  {content}
                </Link>
              ) : (
                <div className={stepClass}>{content}</div>
              )}
            </Fragment>
          );
        })}
      </div>
    );
  }

  const variant = compact ? 'compact' : detailed ? 'detailed' : 'compact';
  return (
    <div className={`wf wf-${variant} ${className}`}>
      {LIFECYCLE_STEPS.map((step, index) => (
        <Fragment key={step.name}>
          {index > 0 && (
            <span className="wf-arrow" aria-hidden="true">
              {variant === 'detailed' ? '↓' : '→'}
            </span>
          )}
          <div className="wf-step">
            <span className="wf-num">{index + 1}</span>
            <span className="wf-label">{step.name}</span>
            {detailed && <span className="wf-caption">{step.caption}</span>}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
