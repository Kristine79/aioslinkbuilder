/**
 * Score 2.0 panel + placement workflow timeline.
 */

import type { ScoreV2Dto, WorkflowDto } from '../api/types';
import { SCORE_V2_DIMENSION_LABELS, WORKFLOW_STAGE_LABELS } from '../ru';

const DIMS = [
  'relevanceScore',
  'donorQualityScore',
  'placementQualityScore',
  'executionScore',
  'riskScore',
] as const;

export function ScoreV2Panel({ scoreV2 }: { scoreV2: ScoreV2Dto }) {
  return (
    <div>
      <div className="flex between mb-8">
        <span className="score-value">{scoreV2.overall}</span>
        <span className="text-secondary" style={{ fontSize: 12 }}>
          итог 2.0 (веса: рел. 30 · донор 25 · разм. 20 · исп. 15 · риск 10)
        </span>
      </div>
      {DIMS.map((dim) => {
        const value = scoreV2[dim];
        return (
          <div className="bar-row" key={dim}>
            <span className="bar-label">{SCORE_V2_DIMENSION_LABELS[dim]}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${value}%` }} />
            </span>
            <span className="bar-value">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

export function WorkflowPanel({ workflow }: { workflow: WorkflowDto }) {
  return (
    <div>
      <div className="text-secondary" style={{ fontSize: 13, marginBottom: 10 }}>
        {workflow.label}
      </div>
      <div className="workflow-steps">
        {workflow.stages.map((stage) => (
          <div key={stage.kind} className={`workflow-step ${stage.current ? 'current' : ''}`}>
            <span className="workflow-dot">
              {stage.current ? '●' : stage.automated ? '◍' : '○'}
            </span>
            <span className="workflow-label">
              {WORKFLOW_STAGE_LABELS[stage.kind] ?? stage.label}
            </span>
            {stage.current && <span className="chip">сейчас</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
