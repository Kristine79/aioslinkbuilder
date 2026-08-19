import type { DonorRiskAssessment } from './donor-risk.js';
import type { PlacementMethod } from './enums/placement-method.js';
import type { PlacementStatus } from './enums/placement-status.js';
import type { NegotiationSession } from './negotiation.js';
import type { OutreachDraft } from './outreach.js';

/**
 * Human-in-the-loop actions ("Требует действия").
 *
 * Each item explains WHY the human action is required, WHAT the AI already
 * prepared and WHAT the human needs to do. The derivation is deterministic
 * domain logic based on the current opportunity state — the UI never decides
 * which actions to show.
 */

export const HUMAN_ACTION_KINDS = [
  'REVIEW_DONOR',
  'APPROVE_OPPORTUNITY',
  'APPROVE_OUTREACH',
  'DONOR_REPLIED',
  'NEGOTIATE_PRICE',
  'MANUAL_PLACEMENT',
  'CONFIRM_PUBLICATION',
] as const;

export type HumanActionKind = (typeof HUMAN_ACTION_KINDS)[number];

export interface HumanActionItem {
  id: string;
  kind: HumanActionKind;
  title: string;
  why: string;
  aiPrepared: string;
  humanTask: string;
  actionLabel: string;
  opportunityId: string;
  placementId: string | null;
}

export interface HumanActionContext {
  opportunityId: string;
  opportunityStatus: PlacementStatus;
  placementMethod: PlacementMethod;
  placementType: string;
  risk: DonorRiskAssessment | null;
  hasIntel: boolean;
  outreach: OutreachDraft | null;
  negotiation: NegotiationSession | null;
  manualPlacements: readonly { id: string; reason: string | null }[];
}

export function deriveHumanActions(context: HumanActionContext): HumanActionItem[] {
  const items: HumanActionItem[] = [];

  const add = (item: Omit<HumanActionItem, 'id'>): void => {
    items.push({ ...item, id: `${item.kind}-${item.opportunityId}` });
  };

  // 1. High-risk donor requires a human check.
  if (context.hasIntel && context.risk !== null && context.risk.level === 'HIGH') {
    add({
      kind: 'REVIEW_DONOR',
      title: 'Требуется проверить донора',
      why: 'Риск донора оценён как высокий.',
      aiPrepared:
        'AI подготовил полный профиль донора (трафик, авторитетность, индексация) и список факторов риска.',
      humanTask: 'Проверьте профиль донора и решите, стоит ли продолжать работу с площадкой.',
      actionLabel: 'Проверить донора',
      opportunityId: context.opportunityId,
      placementId: null,
    });
  }

  // 2. Opportunity needs approval.
  if (context.opportunityStatus === 'QUALIFIED') {
    add({
      kind: 'APPROVE_OPPORTUNITY',
      title: 'Требуется одобрить возможность',
      why: 'AI оценил площадку и рекомендует размещение.',
      aiPrepared: 'AI подготовил оценку, разбивку баллов и объяснение рекомендации.',
      humanTask: 'Одобрите возможность, чтобы перейти к следующему этапу.',
      actionLabel: 'Одобрить',
      opportunityId: context.opportunityId,
      placementId: null,
    });
  }

  // 3. Outreach-based placement: review the prepared outreach.
  const isOutreachBased =
    context.placementMethod === 'OUTREACH' || context.placementMethod === 'MANUAL';
  if (isOutreachBased && context.outreach !== null) {
    if (context.outreach.status === 'DRAFT' || context.outreach.status === 'READY_FOR_REVIEW') {
      add({
        kind: 'APPROVE_OUTREACH',
        title: 'Требуется одобрить outreach',
        why: 'AI подготовил черновик сообщения площадке.',
        aiPrepared:
          'AI подготовил персонализированное сообщение: тема, приветствие, ценностное предложение и запрос размещения.',
        humanTask: 'Проверьте и одобрите текст, после чего сообщение можно отправить.',
        actionLabel: 'Проверить outreach',
        opportunityId: context.opportunityId,
        placementId: null,
      });
    }

    // 4. Donor replied — negotiation.
    const latestDonorReply = [...(context.negotiation?.replies ?? [])]
      .reverse()
      .find((reply) => reply.role === 'donor');
    if (context.outreach.status === 'SENT' && latestDonorReply !== undefined) {
      const negotiationReady = context.negotiation?.analysis !== null;
      add({
        kind: 'DONOR_REPLIED',
        title: 'Получен ответ от площадки',
        why: 'Площадка ответила на ваше сообщение.',
        aiPrepared: negotiationReady
          ? `AI проанализировал ответ: ${context.negotiation?.analysis?.intent ?? 'MANUAL_REVIEW'}.`
          : 'Ответ площадки записан, анализ ещё не выполнен.',
        humanTask: 'Откройте ответ и, при необходимости, отправьте подготовленный ответ AI.',
        actionLabel: 'Открыть переговоры',
        opportunityId: context.opportunityId,
        placementId: null,
      });
    }

    if (
      context.negotiation?.analysis?.intent === 'PRICE_NEGOTIATION' &&
      context.outreach.status !== 'AGREED' &&
      context.outreach.status !== 'REJECTED'
    ) {
      const range = context.negotiation.analysis.recommendedPrice;
      add({
        kind: 'NEGOTIATE_PRICE',
        title: 'Требуется согласовать цену',
        why: 'Площадка выдвинула ценовое условие.',
        aiPrepared: `AI рекомендует диапазон${
          range !== null ? ` ${range.min}–${range.max} ${range.currency}` : ''
        } и подготовил ответ.`,
        humanTask: 'Согласуйте цену и отправьте ответ площадке.',
        actionLabel: 'Согласовать цену',
        opportunityId: context.opportunityId,
        placementId: null,
      });
    }
  }

  // 5. Manual placement requested by the platform (NEEDS_MANUAL).
  for (const placement of context.manualPlacements) {
    add({
      kind: 'MANUAL_PLACEMENT',
      title: 'Требуется ручное размещение',
      why: 'Размещение невозможно выполнить автоматически.',
      aiPrepared: 'AI подготовил анкор, текст вставки и инструкцию по размещению.',
      humanTask: 'Выполните размещение на площадке вручную и подтвердите публикацию.',
      actionLabel: 'Выполнить вручную',
      opportunityId: context.opportunityId,
      placementId: placement.id,
    });
  }

  return items;
}
