/**
 * Russian UI terminology. Labels only — all state values come from the
 * backend; nothing about transitions or scoring is defined here.
 */

import type {
  EvidenceType,
  PlacementStatus,
  PlanRecommendation,
  VerificationStatus,
} from './api/types';

export const STATUS_LABELS: Record<PlacementStatus, string> = {
  DISCOVERED: 'Обнаружено',
  QUALIFIED: 'Рекомендовано',
  SELECTED: 'Одобрено',
  READY: 'Готово к запуску',
  SUBMITTED: 'Отправлено',
  PENDING_PUBLICATION: 'Ожидает публикации',
  PUBLISHED: 'Опубликовано',
  VERIFIED: 'Проверено',
  FAILED: 'Ошибка',
  BLOCKED: 'Заблокировано',
  NEEDS_MANUAL: 'Нужна ручная работа',
  VERIFICATION_FAILED: 'Проверка не пройдена',
  REJECTED: 'Отклонено',
};

export const METHOD_LABELS: Record<string, string> = {
  API: 'API',
  SEMI_AUTOMATED: 'Полуавтомат',
  BROWSER: 'Браузер',
  MANUAL: 'Вручную',
  OUTREACH: 'Аутрич',
  UNKNOWN: 'Недоступно',
};

export const TYPE_LABELS: Record<string, string> = {
  BACKLINK: 'Ссылка',
  BRAND_MENTION: 'Упоминание бренда',
  BUSINESS_PROFILE: 'Профиль компании',
  DIRECTORY_LISTING: 'Каталог',
  PRODUCT_LISTING: 'Карточка товара',
  EDITORIAL_PUBLICATION: 'Публикация',
  SOCIAL_PROFILE: 'Профиль в соцсетях',
  REFERRAL_TRAFFIC: 'Реферальный трафик',
  LINK_INSERT: 'Вставка ссылки',
  GUEST_POST: 'Гостевой пост',
  RESOURCE_PAGE: 'Ресурсная страница',
  PARTNER_PAGE: 'Страница партнёра',
};

export const OUTREACH_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  READY_FOR_REVIEW: 'Готов к проверке',
  APPROVED: 'Одобрен',
  SENT: 'Отправлен',
  REPLIED: 'Получен ответ',
  NEGOTIATING: 'Переговоры',
  AGREED: 'Согласовано',
  REJECTED: 'Отклонено',
  NO_RESPONSE: 'Нет ответа',
};

export const NEGOTIATION_INTENT_LABELS: Record<string, string> = {
  ACCEPTED: 'Принято',
  REJECTED: 'Отклонено',
  PRICE_NEGOTIATION: 'Переговоры о цене',
  CONTENT_REQUIREMENTS: 'Требования к контенту',
  LINK_ATTRIBUTE_REQUEST: 'Запрос об атрибутах ссылки',
  NEEDS_CLARIFICATION: 'Нужно уточнение',
  MANUAL_REVIEW: 'Нужна ручная проверка',
};

export const ANCHOR_TYPE_LABELS: Record<string, string> = {
  EXACT_MATCH: 'Exact-match',
  PARTIAL_MATCH: 'Partial-match',
  BRANDED: 'Branded',
  GENERIC: 'Generic',
  URL: 'URL',
  LONG_TAIL: 'Long-tail',
};

export const METRIC_STATUS_LABELS: Record<string, string> = {
  MEASURED: 'измерено',
  AI_ESTIMATED: 'оценка AI',
  INTERNAL: 'внутренний расчёт',
  SYNTHETIC: 'демо-данные',
  UNKNOWN: 'нет данных',
};

export const METRIC_STATUS_TONES: Record<string, string> = {
  MEASURED: 'tone-green',
  AI_ESTIMATED: 'tone-blue',
  INTERNAL: 'tone-indigo',
  SYNTHETIC: 'tone-amber',
  UNKNOWN: 'tone-gray',
};

export const RISK_LEVEL_LABELS: Record<string, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
  UNKNOWN: 'Не оценён',
};

export const RISK_LEVEL_TONES: Record<string, string> = {
  LOW: 'tone-green',
  MEDIUM: 'tone-amber',
  HIGH: 'tone-red',
  UNKNOWN: 'tone-gray',
};

export const DONOR_QUALITY_LEVEL_LABELS: Record<string, string> = {
  EXCELLENT: 'Отлично',
  GOOD: 'Хорошо',
  FAIR: 'Средне',
  POOR: 'Слабо',
  UNKNOWN: 'Не оценено',
};

export const PAGE_TYPE_LABELS: Record<string, string> = {
  EDITORIAL: 'Редакционная',
  RESOURCE: 'Ресурсная',
  BLOG: 'Блог',
  PRODUCT: 'Товарная',
  PROFILE: 'Профиль',
  LISTING: 'Листинг',
  NEWS: 'Новость',
  CATEGORY: 'Категория',
  OTHER: 'Другое',
  UNKNOWN: 'Не определён',
};

export const HUMAN_ACTION_LABELS: Record<string, string> = {
  REVIEW_DONOR: 'Проверка донора',
  APPROVE_OPPORTUNITY: 'Одобрение возможности',
  APPROVE_OUTREACH: 'Одобрение outreach',
  DONOR_REPLIED: 'Ответ донора',
  NEGOTIATE_PRICE: 'Согласование цены',
  MANUAL_PLACEMENT: 'Ручное размещение',
  CONFIRM_PUBLICATION: 'Подтверждение публикации',
};

export const SCORE_V2_DIMENSION_LABELS: Record<string, string> = {
  relevanceScore: 'Релевантность',
  donorQualityScore: 'Качество донора',
  placementQualityScore: 'Качество размещения',
  executionScore: 'Исполнение',
  riskScore: 'Риск',
};

export const SORT_LABELS: Record<string, string> = {
  score: 'По баллу',
  donorQuality: 'По качеству донора',
  traffic: 'По трафику',
  relevance: 'По релевантности',
  lowestRisk: 'По наименьшему риску',
  ease: 'По простоте исполнения',
};

export const WORKFLOW_STAGE_LABELS: Record<string, string> = {
  research: 'Исследование',
  page_analysis: 'Анализ страницы',
  approval: 'Одобрение',
  outreach: 'Outreach',
  negotiation: 'Переговоры',
  content: 'Контент',
  submission: 'Отправка',
  execution: 'Исполнение',
  placement: 'Размещение',
  verification: 'Проверка',
};

export const PROVIDER_TYPE_LABELS: Record<string, string> = {
  API: 'API-провайдер',
  BROWSER: 'Браузерная автоматизация',
  MANUAL: 'Ручной процесс',
  MOCK: 'Демо-провайдер',
};

export const DISCOVERY_SOURCE_LABELS: Record<string, string> = {
  catalog: 'Каталог',
  search: 'Поиск',
  'web-search': 'Веб-поиск',
  recommendation: 'Рекомендация',
  manual: 'Ручное добавление',
  unknown: 'Неизвестен',
};

export const AI_PROVIDER_LABELS: Record<string, string> = {
  'demo-ai': 'Демо-провайдер анализа',
  'scenario-stub': 'Демо-провайдер анализа',
  'opencode-go': 'OpenCode Go',
};

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активна',
  COMPLETED: 'Завершена',
};

/** Current product stage of a campaign (labels only; the stage comes from the backend). */
export const CAMPAIGN_STAGE_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  SEARCH: 'Поиск площадок',
  SEARCHING: 'Поиск площадок выполняется…',
  SEARCH_EMPTY: 'Поиск выполнен · возможностей нет',
  SEARCH_FAILED: 'Поиск завершился ошибкой',
  REVIEW: 'Оценка доноров',
  PREPARE: 'Подготовка размещения',
  PLACEMENT: 'Размещение',
  VERIFICATION: 'Проверка',
  COMPLETED: 'Завершено',
};

export const CAMPAIGN_STAGE_TONES: Record<string, string> = {
  DRAFT: 'tone-gray',
  SEARCH: 'tone-blue',
  SEARCHING: 'tone-blue',
  SEARCH_EMPTY: 'tone-amber',
  SEARCH_FAILED: 'tone-red',
  REVIEW: 'tone-indigo',
  PREPARE: 'tone-indigo',
  PLACEMENT: 'tone-blue',
  VERIFICATION: 'tone-teal',
  COMPLETED: 'tone-green',
};

/** Компактный pipeline кампании на карточке: этап, где кампания сейчас, и что впереди. */
export const CAMPAIGN_STEPS: readonly string[] = [
  'Анализ',
  'Стратегия',
  'Поиск',
  'Оценка',
  'Размещение',
  'Проверка',
];

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  PENDING: 'Ожидает проверки',
  PASSED: 'Проверка пройдена',
  FAILED: 'Проверка не пройдена',
};

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  LIVE_URL: 'Публичная ссылка',
  SCREENSHOT: 'Скриншот',
  PAGE_CONTENT: 'Содержимое страницы',
  COMPANY_MATCH: 'Совпадение компании',
  WEBSITE_MATCH: 'Совпадение сайта',
  BACKLINK_MATCH: 'Совпадение ссылки',
};

export const ACTION_LABELS: Record<string, string> = {
  approve: 'Одобрить',
  execute: 'Запустить',
  monitor: 'Проверить статус',
  verify: 'Проверить',
  requestManual: 'Оформить вручную',
  completeManual: 'Подтвердить публикацию',
};

export const PLAN_RECOMMENDATION_LABELS: Record<PlanRecommendation, string> = {
  RECOMMENDED: 'Рекомендовано',
  REVIEW_REQUIRED: 'Требует вашего решения',
  NOT_RECOMMENDED: 'Не рекомендуется',
  INSUFFICIENT_DATA: 'Недостаточно данных',
};

export const PLAN_NEXT_ACTION_LABELS: Record<string, string> = {
  PREPARE_OUTREACH: 'Подготовить outreach',
  REQUEST_MANUAL_PLACEMENT: 'Оформить вручную',
  EXECUTE_AUTOMATICALLY: 'Запустить автоматически',
  REVIEW_PROVIDER: 'Проверить провайдера',
  REVIEW_OPPORTUNITY: 'Проверить возможность',
  REJECT: 'Отклонить',
};

export const PLAN_AUTOMATION_LABELS: Record<string, string> = {
  AUTOMATIC: 'Автоматически',
  AI_ASSISTED: 'С участием AI',
  HUMAN_REQUIRED: 'Требует человека',
};

export const PLAN_REJECTION_LABELS: Record<string, string> = {
  LOW_SCORE: 'Низкая оценка',
  HIGH_RISK: 'Высокий риск',
  NO_PROVIDER: 'Нет провайдера',
  UNSUITABLE_PLACEMENT_TYPE: 'Неподходящий тип размещения',
  MANUAL_NEGOTIATION_REQUIRED: 'Требуются переговоры',
  LOW_RELEVANCE: 'Низкая релевантность',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  COMPANY_ANALYZED: 'Анализ компании выполнен',
  CAMPAIGN_CREATED: 'Кампания создана',
  COMPANY_CREATED: 'Компания создана',
  OPPORTUNITY_DISCOVERED: 'Возможность найдена',
  OPPORTUNITY_CLASSIFIED: 'Возможность оценена',
  OPPORTUNITY_SELECTED: 'Возможность одобрена',
  OPPORTUNITY_READY: 'Возможность готова к запуску',
  PLACEMENT_SUBMITTED: 'Размещение отправлено',
  PLACEMENT_PUBLISHED: 'Размещение опубликовано',
  PLACEMENT_FAILED: 'Ошибка размещения',
  PLACEMENT_STATUS_CHANGED: 'Статус размещения изменён',
  PLACEMENT_NEEDS_MANUAL: 'Требуется ручная работа',
  PLACEMENT_MANUALLY_PUBLISHED: 'Опубликовано вручную',
  PLACEMENT_VERIFIED: 'Размещение проверено',
  PLACEMENT_VERIFICATION_FAILED: 'Проверка размещения не пройдена',
  OPPORTUNITY_INTEL_ASSESSED: 'Профиль донора и оценка обновлены',
  LINK_INSERT_GENERATED: 'Подготовлена вставка ссылки',
  ANCHOR_RECOMMENDED: 'Рекомендован анкор',
  OUTREACH_GENERATED: 'Outreach подготовлен',
  OUTREACH_SENT: 'Outreach отправлен',
  OUTREACH_STATUS_CHANGED: 'Статус outreach изменён',
  DONOR_REPLY_RECEIVED: 'Получен ответ донора',
  NEGOTIATION_ANALYZED: 'Ответ проанализирован AI',
  NEGOTIATION_RESPONDED: 'Ответ согласован человеком',
  NEGOTIATION_AGREED: 'Договорённость достигнута',
  PLACEMENT_PLAN_GENERATED: 'План размещений сформирован',
};

export const FUNNEL_LABELS: Record<string, string> = {
  discovered: 'Найдено',
  recommended: 'Рекомендовано',
  approved: 'Одобрено',
  executed: 'Запущено',
  published: 'Опубликовано',
  verified: 'Проверено',
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  Company: 'Компания',
  Campaign: 'Кампания',
  PlacementOpportunity: 'Возможность',
  Placement: 'Размещение',
  Verification: 'Проверка',
};

export const AUDIT_FILTER_LABELS: Record<string, string> = {
  all: 'Все события',
  placements: 'Размещения',
  opportunities: 'Возможности',
  analysis: 'Анализ',
  errors: 'Ошибки',
  manual: 'Ручные действия',
};

export const SCORE_DIMENSION_LABELS: Record<string, string> = {
  topicalRelevance: 'Тематическое соответствие',
  audienceMatch: 'Совпадение аудитории',
  geographicRelevance: 'География',
  authority: 'Авторитетность',
  placementQuality: 'Качество размещения',
  automationPotential: 'Автоматизация',
};

export const CAPABILITY_LABELS: Record<string, string> = {
  DISCOVER: 'Поиск',
  VALIDATE: 'Валидация',
  CREATE: 'Создание',
  UPDATE: 'Обновление',
  GET_STATUS: 'Статус',
  VERIFY: 'Проверка',
};

export const FUNNEL_ORDER = [
  'discovered',
  'recommended',
  'approved',
  'executed',
  'published',
  'verified',
] as const;

export const PRIORITY_LABELS: Record<string, string> = {
  HIGH: 'Высокий',
  MEDIUM: 'Средний',
};

export function pluralRu(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function formatDateTime(value: string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const date = new Date(value);
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
