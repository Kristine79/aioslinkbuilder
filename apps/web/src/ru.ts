/**
 * Russian UI terminology. Labels only — all state values come from the
 * backend; nothing about transitions or scoring is defined here.
 */

import type { EvidenceType, PlacementStatus, VerificationStatus } from './api/types';

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
  recommendation: 'Рекомендация',
  manual: 'Ручное добавление',
  unknown: 'Неизвестен',
};

export const AI_PROVIDER_LABELS: Record<string, string> = {
  'demo-ai': 'Демо-провайдер анализа',
  'scenario-stub': 'Демо-провайдер анализа',
};

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активна',
  COMPLETED: 'Завершена',
};

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
