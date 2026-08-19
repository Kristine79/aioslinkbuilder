import type { PlacementStatus } from './enums/placement-status.js';
import type { PlacementType } from './enums/placement-type.js';

/**
 * Workflow metadata per placement type. Each placement type declares the
 * recommended sequence of stages a placement should go through. The system
 * uses this to render the workflow timeline in the UI and to highlight the
 * current stage from the placement status.
 *
 * Stage flags describe how the stage is executed:
 * - `automated`: AI/automation prepares or performs the stage;
 * - `hitl`: a human decision/action is required at this stage;
 * - `required`: the stage is part of the happy path for this placement type.
 */

export type WorkflowStageKind =
  | 'research'
  | 'page_analysis'
  | 'approval'
  | 'outreach'
  | 'negotiation'
  | 'content'
  | 'submission'
  | 'execution'
  | 'placement'
  | 'verification';

export interface WorkflowStage {
  kind: WorkflowStageKind;
  label: string;
  automated: boolean;
  hitl: boolean;
  required: boolean;
}

export interface PlacementTypeWorkflow {
  placementType: PlacementType;
  label: string;
  stages: readonly WorkflowStage[];
}

const stage = (
  kind: WorkflowStageKind,
  label: string,
  flags: { automated?: boolean; hitl?: boolean; required?: boolean } = {},
): WorkflowStage => ({
  kind,
  label,
  automated: flags.automated ?? false,
  hitl: flags.hitl ?? false,
  required: flags.required ?? true,
});

export const PLACEMENT_TYPE_WORKFLOWS: Readonly<Record<PlacementType, PlacementTypeWorkflow>> = {
  LINK_INSERT: {
    placementType: 'LINK_INSERT',
    label: 'Вставка ссылки в существующий материал',
    stages: [
      stage('research', 'Исследование', { automated: true }),
      stage('page_analysis', 'Анализ страницы', { automated: true }),
      stage('approval', 'Одобрение', { hitl: true }),
      stage('outreach', 'Outreach', { automated: true, hitl: true }),
      stage('negotiation', 'Переговоры', { hitl: true }),
      stage('placement', 'Размещение', { hitl: true }),
      stage('verification', 'Проверка', { automated: true }),
    ],
  },
  GUEST_POST: {
    placementType: 'GUEST_POST',
    label: 'Гостевой пост',
    stages: [
      stage('research', 'Исследование', { automated: true }),
      stage('outreach', 'Outreach', { automated: true, hitl: true }),
      stage('negotiation', 'Переговоры', { hitl: true }),
      stage('content', 'Подготовка контента', { automated: true, hitl: true }),
      stage('submission', 'Отправка материала', { hitl: true }),
      stage('placement', 'Публикация', { hitl: true }),
      stage('verification', 'Проверка', { automated: true }),
    ],
  },
  RESOURCE_PAGE: {
    placementType: 'RESOURCE_PAGE',
    label: 'Ресурсная страница',
    stages: [
      stage('research', 'Исследование', { automated: true }),
      stage('page_analysis', 'Анализ страницы', { automated: true }),
      stage('outreach', 'Outreach', { automated: true, hitl: true }),
      stage('negotiation', 'Переговоры', { hitl: true }),
      stage('content', 'Подготовка контента', { automated: true, hitl: true }),
      stage('placement', 'Размещение', { hitl: true }),
      stage('verification', 'Проверка', { automated: true }),
    ],
  },
  PARTNER_PAGE: {
    placementType: 'PARTNER_PAGE',
    label: 'Страница партнёра',
    stages: [
      stage('research', 'Исследование', { automated: true }),
      stage('outreach', 'Outreach', { automated: true, hitl: true }),
      stage('negotiation', 'Переговоры', { hitl: true }),
      stage('content', 'Подготовка контента', { automated: true, hitl: true }),
      stage('placement', 'Размещение', { hitl: true }),
      stage('verification', 'Проверка', { automated: true }),
    ],
  },
  EDITORIAL_PUBLICATION: {
    placementType: 'EDITORIAL_PUBLICATION',
    label: 'Редакционная публикация',
    stages: [
      stage('research', 'Исследование', { automated: true }),
      stage('outreach', 'Outreach', { automated: true, hitl: true }),
      stage('negotiation', 'Переговоры', { hitl: true }),
      stage('content', 'Подготовка контента', { automated: true, hitl: true }),
      stage('submission', 'Отправка материала', { hitl: true }),
      stage('placement', 'Публикация', { hitl: true }),
      stage('verification', 'Проверка', { automated: true }),
    ],
  },
  BACKLINK: {
    placementType: 'BACKLINK',
    label: 'Ссылка',
    stages: [
      stage('research', 'Исследование', { automated: true }),
      stage('page_analysis', 'Анализ страницы', { automated: true }),
      stage('outreach', 'Outreach', { automated: true, hitl: true }),
      stage('negotiation', 'Переговоры', { hitl: true }),
      stage('placement', 'Размещение', { hitl: true }),
      stage('verification', 'Проверка', { automated: true }),
    ],
  },
  BRAND_MENTION: {
    placementType: 'BRAND_MENTION',
    label: 'Упоминание бренда',
    stages: [
      stage('research', 'Исследование', { automated: true }),
      stage('outreach', 'Outreach', { automated: true, hitl: true }),
      stage('negotiation', 'Переговоры', { hitl: true }),
      stage('content', 'Подготовка контента', { automated: true, hitl: true }),
      stage('placement', 'Размещение', { hitl: true }),
      stage('verification', 'Проверка', { automated: true }),
    ],
  },
  BUSINESS_PROFILE: {
    placementType: 'BUSINESS_PROFILE',
    label: 'Профиль компании',
    stages: [
      stage('research', 'Исследование', { automated: true }),
      stage('approval', 'Одобрение', { hitl: true }),
      stage('execution', 'Исполнение', { automated: true }),
      stage('verification', 'Проверка', { automated: true }),
    ],
  },
  DIRECTORY_LISTING: {
    placementType: 'DIRECTORY_LISTING',
    label: 'Каталог',
    stages: [
      stage('research', 'Исследование', { automated: true }),
      stage('approval', 'Одобрение', { hitl: true }),
      stage('execution', 'Исполнение', { automated: true }),
      stage('verification', 'Проверка', { automated: true }),
    ],
  },
  PRODUCT_LISTING: {
    placementType: 'PRODUCT_LISTING',
    label: 'Карточка товара',
    stages: [
      stage('research', 'Исследование', { automated: true }),
      stage('approval', 'Одобрение', { hitl: true }),
      stage('execution', 'Исполнение', { automated: true }),
      stage('verification', 'Проверка', { automated: true }),
    ],
  },
  SOCIAL_PROFILE: {
    placementType: 'SOCIAL_PROFILE',
    label: 'Профиль в соцсетях',
    stages: [
      stage('research', 'Исследование', { automated: true }),
      stage('approval', 'Одобрение', { hitl: true }),
      stage('execution', 'Исполнение', { automated: true }),
      stage('verification', 'Проверка', { automated: true }),
    ],
  },
  REFERRAL_TRAFFIC: {
    placementType: 'REFERRAL_TRAFFIC',
    label: 'Реферальный трафик',
    stages: [
      stage('research', 'Исследование', { automated: true }),
      stage('approval', 'Одобрение', { hitl: true }),
      stage('execution', 'Исполнение', { automated: true }),
      stage('verification', 'Проверка', { automated: true }),
    ],
  },
};

export const WORKFLOW_STAGE_KINDS: readonly WorkflowStageKind[] = [
  'research',
  'page_analysis',
  'approval',
  'outreach',
  'negotiation',
  'content',
  'submission',
  'execution',
  'placement',
  'verification',
] as const;

export function workflowForType(placementType: PlacementType): PlacementTypeWorkflow {
  return PLACEMENT_TYPE_WORKFLOWS[placementType];
}

/**
 * Placement types whose primary execution model is human outreach:
 * research/outreach/negotiation precede any placement, and no API or browser
 * provider is required. Used to derive the placement method during
 * classification.
 */
export const OUTREACH_METHOD_PLACEMENT_TYPES: readonly PlacementType[] = [
  'LINK_INSERT',
  'GUEST_POST',
  'RESOURCE_PAGE',
  'PARTNER_PAGE',
] as const;

export function isOutreachPlacementType(placementType: PlacementType): boolean {
  return OUTREACH_METHOD_PLACEMENT_TYPES.includes(placementType);
}

/**
 * Determines the current workflow stage kind from the placement status and
 * (for outreach-driven workflows) the outreach status. Used by the UI to
 * highlight the active stage of the workflow timeline. Deterministic.
 */
export function workflowCurrentStageKind(
  placementType: PlacementType,
  status: PlacementStatus,
  outreachStatus: string | null,
): WorkflowStageKind | null {
  if (isOutreachPlacementType(placementType)) {
    switch (outreachStatus) {
      case 'DRAFT':
      case 'READY_FOR_REVIEW':
      case 'APPROVED':
      case 'SENT':
        return 'outreach';
      case 'REPLIED':
      case 'NEGOTIATING':
        return 'negotiation';
      case 'AGREED':
        return 'placement';
      case 'REJECTED':
      case 'NO_RESPONSE':
        return 'negotiation';
      default:
        break;
    }
  }

  switch (status) {
    case 'DISCOVERED':
      return 'research';
    case 'QUALIFIED':
      return isOutreachPlacementType(placementType) ? 'research' : 'research';
    case 'SELECTED':
    case 'READY':
      return 'approval';
    case 'SUBMITTED':
    case 'PENDING_PUBLICATION':
    case 'PUBLISHED':
    case 'NEEDS_MANUAL':
    case 'FAILED':
    case 'BLOCKED':
    case 'REJECTED':
    case 'VERIFICATION_FAILED':
      return 'placement';
    case 'VERIFIED':
      return 'verification';
    default:
      return null;
  }
}
