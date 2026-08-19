/**
 * Visual product workflow: DISCOVER → QUALIFY → CREATE → OUTREACH →
 * NEGOTIATE → PLACE → VERIFY.
 *
 * Presentation only — stage names are the product's public workflow
 * terminology; the captions are UI copy in Russian. The compact variant is
 * used on the dashboard hero, the detailed variant in the Help Center.
 */

import { Fragment } from 'react';

export interface WorkflowStep {
  name: string;
  caption: string;
}

export const LIFECYCLE_STEPS: readonly WorkflowStep[] = [
  {
    name: 'DISCOVER',
    caption: 'Поиск потенциальных площадок и страниц: каталог категорий и веб-поиск.',
  },
  {
    name: 'QUALIFY',
    caption: 'Детерминированный scoring и AI-оценка релевантности, донора, рисков и пригодности.',
  },
  {
    name: 'CREATE',
    caption: 'Подготовка конкретного варианта размещения: тип, анкор и текст link insert.',
  },
  {
    name: 'OUTREACH',
    caption:
      'AI формирует персональное письмо владельцу площадки — человек проверяет и отправляет.',
  },
  {
    name: 'NEGOTIATE',
    caption: 'Ответ донора анализируется: намерение, стратегия и предлагаемый ответ.',
  },
  {
    name: 'PLACE',
    caption: 'Запуск размещения через провайдера или вручную, если требуется человек.',
  },
  {
    name: 'VERIFY',
    caption: 'Проверка результата и сохранение доказательств (URL, содержимое, скриншот).',
  },
];

export function WorkflowDiagram({
  detailed = false,
  compact = false,
  className = '',
}: {
  detailed?: boolean;
  compact?: boolean;
  className?: string;
}) {
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
