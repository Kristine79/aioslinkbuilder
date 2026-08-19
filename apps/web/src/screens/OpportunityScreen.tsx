/**
 * Детали возможности — execution lifecycle.
 * Shows the opportunity (score, recommendation, provider, capabilities) and
 * every placement attempt with state-gated actions. All transitions go
 * through the backend use cases; the UI only offers what the backend
 * reports as allowed for the current state.
 *
 * Two signals are displayed separately: «Публикация» (submitted → published)
 * and «Проверка» (verification with evidence) — a placement can be published
 * while its verification is still pending.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../api/client';
import type { ActivityDto, EvidenceType, OpportunityDto, PlacementDto } from '../api/types';
import {
  Alert,
  Card,
  Chip,
  ChipList,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '../components/ui';
import { ScoreBadge, ScoreBreakdown } from '../components/Score';
import { DonorQualityPanel } from '../components/DonorQualityPanel';
import { HelpTip } from '../components/HelpTip';
import { PageAnalysisPanel, LinkInsertPanel } from '../components/PagePanel';
import { OutreachPanel } from '../components/OutreachPanel';
import { ScoreV2Panel, WorkflowPanel } from '../components/ScoreWorkflowPanel';
import { HumanActionsPanel } from '../components/HumanActionsPanel';
import {
  ACTION_LABELS,
  AUDIT_ACTION_LABELS,
  CAPABILITY_LABELS,
  DISCOVERY_SOURCE_LABELS,
  EVIDENCE_LABELS,
  METHOD_LABELS,
  PROVIDER_TYPE_LABELS,
  TYPE_LABELS,
  formatDateTime,
} from '../ru';

export function OpportunityScreen() {
  const { id } = useParams<{ id: string }>();
  const [opportunity, setOpportunity] = useState<OpportunityDto | null>(null);
  const [audit, setAudit] = useState<ActivityDto['audit']>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (id === undefined) return;
    setError(null);
    Promise.all([api.opportunity(id), api.activity()])
      .then(([detail, activity]) => {
        setOpportunity(detail);
        setAudit(activity.audit);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = useCallback(
    async (task: () => Promise<unknown>, successMessage: string) => {
      setBusy(true);
      setActionError(null);
      setActionMessage(null);
      try {
        await task();
        setActionMessage(successMessage);
        load();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const aiAssistActions = useCallback(() => {
    if (id === undefined) return;
    return {
      runIntel: () => runAction(() => api.intel(id), 'Профиль донора и оценка обновлены.'),
      runLinkInsert: (desiredAnchor?: string) =>
        runAction(
          () => api.linkInsert(id, desiredAnchor),
          'Подготовка вставки и анкор-стратегия сформированы.',
        ),
      runOutreach: () => runAction(() => api.generateOutreach(id), 'Outreach подготовлен.'),
      onOutreachStatus: (status: string) =>
        runAction(
          () => api.outreachStatus(id, status),
          status === 'SENT' ? 'Outreach отправлен (вручную).' : 'Статус outreach обновлён.',
        ),
      onAnalyzeReply: (reply: string) =>
        runAction(() => api.analyzeReply(id, reply), 'Ответ площадки проанализирован AI.'),
      onRespond: (payload: { agree: boolean; customResponse?: string }) =>
        runAction(
          () => api.negotiateRespond(id, payload),
          payload.agree ? 'Договорённость достигнута.' : 'Ответ отправлен.',
        ),
    };
  }, [id, runAction]);

  const aiAssist = aiAssistActions();

  if (opportunity === null && error === null) {
    return <LoadingState text="Загружаем возможность…" />;
  }
  if (opportunity === null) {
    return <ErrorState message={error ?? 'Неизвестная ошибка'} onRetry={load} />;
  }

  const canRequestManual = opportunity.allowedActions.includes('requestManual');
  const canExecute = opportunity.allowedActions.includes('execute');
  const canApprove = opportunity.allowedActions.includes('approve');
  const isDemoProvider = opportunity.provider?.type === 'MOCK';

  const placementIds = new Set(opportunity.placements.map((placement) => placement.id));
  const opportunityAudit = audit.filter(
    (entry) =>
      (entry.entityType === 'PlacementOpportunity' && entry.entityId === opportunity.id) ||
      (entry.entityType === 'Placement' && placementIds.has(entry.entityId)),
  );

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <Link to="/opportunities" className="text-secondary" style={{ fontSize: 13 }}>
            ← Все возможности
          </Link>
          <h1 className="page-title mt-8">
            {opportunity.platformName} <StatusBadge status={opportunity.status} />
          </h1>
          <p className="page-subtitle">
            {opportunity.platformUrl !== null && (
              <a href={opportunity.platformUrl} target="_blank" rel="noreferrer">
                {opportunity.platformUrl}
              </a>
            )}
            {opportunity.categoryName !== null ? ` · ${opportunity.categoryName}` : ''}
            {' · '}
            {TYPE_LABELS[opportunity.placementType] ?? opportunity.placementType}
            <HelpTip
              text="Формат размещения: вставка ссылки, гостевой пост, ресурсная страница и другие типы. Подробнее — в Справке."
              align="right"
            />
          </p>
        </div>
        <div className="flex" style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
          <ScoreBadge score={opportunity.score} />
          <span className="score-caption">оценка AI</span>
        </div>
      </div>

      {actionError !== null && (
        <div className="mb-16">
          <Alert tone="error">{actionError}</Alert>
        </div>
      )}
      {actionMessage !== null && (
        <div className="mb-16">
          <Alert tone="success">{actionMessage}</Alert>
        </div>
      )}

      <div className="mb-16">
        <Card
          title="Требует действия"
          actions={
            <HelpTip
              text="Действия, которые система не выполняет без вас: одобрение, проверка, переговоры, ручное размещение."
              align="right"
            />
          }
        >
          <HumanActionsPanel actions={opportunity.humanActions} />
        </Card>
      </div>

      <div className="mb-16">
        <Card
          title="AI-подготовка"
          actions={
            <span className="text-tertiary" style={{ fontSize: 12 }}>
              AI готовит, человек решает и подписывает
            </span>
          }
        >
          <div className="row-actions">
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              disabled={busy}
              onClick={() => void aiAssist?.runIntel()}
            >
              Обновить профиль донора
            </button>
            {(opportunity.placementType === 'LINK_INSERT' ||
              opportunity.placementType === 'RESOURCE_PAGE' ||
              opportunity.placementType === 'GUEST_POST') && (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  disabled={busy}
                  onClick={() => void aiAssist?.runLinkInsert()}
                >
                  Подготовить вставку
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  disabled={busy}
                  onClick={() => void aiAssist?.runOutreach()}
                >
                  Сформировать outreach
                </button>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="detail-grid">
        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Почему это важно">
            {opportunity.scoreBreakdown === null ? (
              <div className="empty-note">
                {opportunity.recommendation ?? 'Оценка ещё не рассчитана.'}
              </div>
            ) : (
              <ScoreBreakdown breakdown={opportunity.scoreBreakdown} />
            )}
          </Card>

          {opportunity.scoreV2 !== null && (
            <Card
              title="Оценка 2.0"
              actions={
                <HelpTip
                  text="Итог из пяти составляющих: релевантность 30%, донор 25%, качество размещения 20%, исполнение 15%, риск 10%."
                  align="right"
                />
              }
            >
              <ScoreV2Panel scoreV2={opportunity.scoreV2} />
            </Card>
          )}

          {opportunity.workflow !== null && (
            <Card title="Рабочий процесс">
              <WorkflowPanel workflow={opportunity.workflow} />
            </Card>
          )}

          {opportunity.donorQuality !== null && (
            <Card
              title="Качество донора"
              actions={
                <>
                  <HelpTip
                    text="Насколько надёжна площадка: авторитетность, трафик, спам-риск, тематика и другие метрики."
                    align="right"
                  />
                  <HelpTip
                    text="У каждой метрики указан источник: измерено / оценка AI / демо / нет данных. UNKNOWN — нормально, система не выдумывает значения."
                    align="right"
                  />
                </>
              }
            >
              <DonorQualityPanel
                donor={opportunity.donorQuality}
                riskLevel={opportunity.risk?.level ?? null}
              />
              {opportunity.risk !== null && opportunity.risk.reasons.length > 0 && (
                <div className="risk-reasons mt-8" style={{ marginTop: 10 }}>
                  <span className="outreach-hint">
                    Факторы риска{' '}
                    <HelpTip
                      text="Сигналы риска донора: спам, качество ссылочного профиля, поведение площадки. Итог — низкий / средний / высокий."
                      align="right"
                    />
                  </span>
                  <ul className="risk-list" style={{ marginTop: 4 }}>
                    {opportunity.risk.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          <Card
            title="Данные площадки"
            actions={
              <HelpTip
                text="Откуда найдена площадка: каталог, веб-поиск или рекомендация. Способ выполнения — как система будет выполнять размещение."
                align="right"
              />
            }
          >
            <div className="kv">
              <span className="kv-key">Платформа</span>
              <span className="kv-value">{opportunity.platformName}</span>
            </div>
            <div className="kv">
              <span className="kv-key">Страна</span>
              <span className="kv-value">{opportunity.country ?? '—'}</span>
            </div>
            <div className="kv">
              <span className="kv-key">Источник обнаружения</span>
              <span className="kv-value">
                {opportunity.discoverySource !== null
                  ? (DISCOVERY_SOURCE_LABELS[opportunity.discoverySource] ??
                    opportunity.discoverySource)
                  : '—'}
              </span>
            </div>
            <div className="kv">
              <span className="kv-key">Способ выполнения</span>
              <span className="kv-value">
                {METHOD_LABELS[opportunity.placementMethod] ?? opportunity.placementMethod}
              </span>
            </div>
            <div className="kv">
              <span className="kv-key">Актуальность</span>
              <span className="kv-value">{opportunity.relevance ?? '—'}</span>
            </div>
          </Card>
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          <Card
            title="Рекомендация AI"
            actions={
              <HelpTip
                text="Почему AI считает эту площадку подходящей: логика выбора и итоговая рекомендация. Решение всё равно за вами."
                align="right"
              />
            }
          >
            {opportunity.whyRecommended !== null && (
              <div style={{ fontSize: 13.5, marginBottom: 8 }}>{opportunity.whyRecommended}</div>
            )}
            {opportunity.recommendation !== null && (
              <p className="text-secondary" style={{ margin: 0, fontSize: 13 }}>
                {opportunity.recommendation}
              </p>
            )}
            {opportunity.whyRecommended === null && opportunity.recommendation === null && (
              <div className="empty-note">Рекомендация ещё не сформирована.</div>
            )}
          </Card>

          {opportunity.pageAnalysis !== null && (
            <Card title="Анализ страницы">
              <PageAnalysisPanel page={opportunity.pageAnalysis} />
            </Card>
          )}

          {opportunity.linkInsert !== null && (
            <Card title="Вставка ссылки">
              <LinkInsertPanel
                linkInsert={opportunity.linkInsert}
                anchor={opportunity.anchorStrategy}
              />
            </Card>
          )}

          {opportunity.outreach !== null && (
            <Card
              title="Outreach"
              actions={
                opportunity.outreach.provider !== null && (
                  <span className="chip">демо-отправка (HITL)</span>
                )
              }
            >
              <OutreachPanel
                outreach={opportunity.outreach}
                negotiation={opportunity.negotiation}
                busy={busy}
                onStatus={(status) => void aiAssist?.onOutreachStatus(status)}
                onAnalyzeReply={(reply) => void aiAssist?.onAnalyzeReply(reply)}
                onRespond={(payload) => void aiAssist?.onRespond(payload)}
              />
            </Card>
          )}

          <Card
            title="Исполнение"
            actions={
              <>
                <HelpTip
                  text="Запуск размещения: автоматически через провайдера или вручную с подтверждением. Ошибки можно повторить новой попыткой."
                  align="right"
                />
                {opportunity.provider !== null ? (
                  <span className="chip">
                    {opportunity.provider.name}
                    {' · '}
                    {PROVIDER_TYPE_LABELS[opportunity.provider.type] ?? opportunity.provider.type}
                    {isDemoProvider ? ' · демо' : ''}
                  </span>
                ) : (
                  <span className="chip">провайдер не выбран</span>
                )}
              </>
            }
          >
            {opportunity.providerCapabilities.length > 0 && (
              <div className="mb-16">
                <ChipList>
                  {opportunity.providerCapabilities.map((capability) => (
                    <Chip key={capability}>{CAPABILITY_LABELS[capability] ?? capability}</Chip>
                  ))}
                  {opportunity.provider !== null && !opportunity.provider.capabilitiesVerified && (
                    <Chip unverified>возможности не проверены</Chip>
                  )}
                </ChipList>
                {isDemoProvider && (
                  <div className="text-tertiary" style={{ fontSize: 12, marginTop: 6 }}>
                    Демо-провайдер: размещение выполняется через симулятор без реального внешнего
                    сервиса.
                  </div>
                )}
              </div>
            )}
            {canApprove && (
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy}
                onClick={() =>
                  void runAction(() => api.approve(opportunity.id), 'Возможность одобрена.')
                }
              >
                {ACTION_LABELS.approve}
              </button>
            )}
            {canExecute && (
              <>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() => api.execute(opportunity.id), 'Запуск выполнен.')
                  }
                >
                  {ACTION_LABELS.execute}
                </button>
                {opportunity.placements.some((placement) => placement.status === 'FAILED') && (
                  <span className="text-tertiary" style={{ fontSize: 12, marginLeft: 10 }}>
                    прошлая попытка завершилась ошибкой — запуск создаст новую попытку
                  </span>
                )}
              </>
            )}
            {canRequestManual && (
              <button
                className="btn btn-secondary"
                type="button"
                disabled={busy}
                onClick={() =>
                  void runAction(
                    () =>
                      api.requestManual(opportunity.id, 'Завершить заявку партнёра на площадке'),
                    'Размещение переведено в ручной режим.',
                  )
                }
              >
                {ACTION_LABELS.requestManual}
              </button>
            )}
            {!canApprove &&
              !canExecute &&
              !canRequestManual &&
              opportunity.placements.length === 0 && (
                <div className="empty-note">
                  Для этой возможности сейчас нет доступных действий — способ выполнения недоступен
                  (нет подходящего провайдера).
                </div>
              )}
          </Card>
        </div>
      </div>

      <div className="mt-16">
        <Card
          title="Попытки размещения"
          actions={
            <span className="text-tertiary" style={{ fontSize: 12 }}>
              каждая ошибка — отдельная попытка со своим журналом
            </span>
          }
        >
          {opportunity.placements.length === 0 ? (
            <div className="empty-note">Размещение ещё не запускалось.</div>
          ) : (
            <div className="timeline">
              {opportunity.placements.map((placement, index) => (
                <PlacementAttempt
                  key={placement.id}
                  placement={placement}
                  attemptNumber={index + 1}
                  totalAttempts={opportunity.placements.length}
                  busy={busy}
                  onAction={async (task) => {
                    await runAction(task, 'Операция выполнена.');
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {opportunityAudit.length > 0 && (
        <div className="mt-16">
          <Card title="Журнал по этой возможности">
            <div className="audit-list">
              {opportunityAudit.map((entry) => (
                <div className="audit-row" key={entry.id}>
                  <span className="audit-time">{formatDateTime(entry.timestamp)}</span>
                  <span className="audit-action">
                    {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span className="audit-meta mono">{entry.entityType}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function PlacementAttempt({
  placement,
  attemptNumber,
  totalAttempts,
  busy,
  onAction,
}: {
  placement: PlacementDto;
  attemptNumber: number;
  totalAttempts: number;
  busy: boolean;
  onAction: (task: () => Promise<unknown>) => Promise<void>;
}) {
  const [showManualForm, setShowManualForm] = useState(false);

  const attemptClass =
    placement.status === 'VERIFIED'
      ? 'done'
      : placement.status === 'FAILED' ||
          placement.status === 'REJECTED' ||
          placement.status === 'BLOCKED' ||
          placement.status === 'VERIFICATION_FAILED'
        ? 'failed'
        : placement.status === 'PUBLISHED' ||
            placement.status === 'SUBMITTED' ||
            placement.status === 'PENDING_PUBLICATION'
          ? 'current'
          : '';

  const published = ['PUBLISHED', 'VERIFIED'].includes(placement.status);
  const verified = placement.verification !== null && placement.verification.status === 'PASSED';

  return (
    <div className={`timeline-item ${attemptClass}`}>
      <div className="flex-between">
        <div className="flex">
          <span className="attempt-number">
            Попытка №{attemptNumber}
            {totalAttempts > 1 ? ` из ${totalAttempts}` : ''}
          </span>
          <StatusBadge status={placement.status} />
          <span className="text-secondary" style={{ fontSize: 13 }}>
            {placement.providerName ?? '—'}
          </span>
          {placement.providerType === 'MOCK' && <span className="chip">демо-провайдер</span>}
        </div>
        <span className="text-tertiary" style={{ fontSize: 12 }}>
          {formatDateTime(placement.createdAt)}
        </span>
      </div>
      <div className="row-sub mt-8">
        {placement.externalId !== null && <span>ID: {placement.externalId}</span>}
        {placement.submittedAt !== null && (
          <span>отправлено: {formatDateTime(placement.submittedAt)}</span>
        )}
        {placement.publishedAt !== null && (
          <span>опубликовано: {formatDateTime(placement.publishedAt)}</span>
        )}
      </div>
      {placement.liveUrl !== null && (
        <div className="mt-8">
          <a href={placement.liveUrl} target="_blank" rel="noreferrer">
            {placement.liveUrl}
          </a>
        </div>
      )}

      <div className="placement-checks">
        <div className={`placement-check ${published ? 'ok' : ''}`}>
          <span className="placement-check-mark">
            {published ? '✓' : placement.status === 'FAILED' ? '✕' : '…'}
          </span>
          Публикация: {published ? 'опубликовано' : 'ожидает'}
        </div>
        <div className={`placement-check ${verified ? 'ok' : ''}`}>
          <span className="placement-check-mark">{verified ? '✓' : '…'}</span>
          Проверка: {verified ? 'проверено' : 'не проведена'}
          <HelpTip
            text="Подтверждение, что размещение реально существует, с сохранением доказательств (URL, содержимое, скриншот)."
            align="right"
          />
        </div>
      </div>

      <div className="row-actions">
        {placement.allowedActions.includes('monitor') && (
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={busy}
            onClick={() => void onAction(() => api.monitor(placement.id))}
          >
            {ACTION_LABELS.monitor}
          </button>
        )}
        {placement.allowedActions.includes('verify') && (
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={busy}
            onClick={() => void onAction(() => api.verify(placement.id))}
          >
            {ACTION_LABELS.verify}
          </button>
        )}
        {placement.allowedActions.includes('completeManual') && (
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={busy}
            onClick={() => setShowManualForm((value) => !value)}
          >
            {ACTION_LABELS.completeManual}
          </button>
        )}
      </div>

      {placement.manual !== null && !showManualForm && (
        <div className="mt-8 text-secondary" style={{ fontSize: 12.5 }}>
          Причина: {placement.manual.reason}
        </div>
      )}

      {showManualForm && (
        <ManualCompletionForm
          busy={busy}
          onSubmit={async (payload) => {
            await onAction(() => api.completeManual(placement.id, payload));
            setShowManualForm(false);
          }}
        />
      )}

      {placement.verification !== null && (
        <div className="verification-result">
          <div className="verification-header">
            <span
              className={`badge ${
                placement.verification.status === 'PASSED'
                  ? 'tone-green'
                  : placement.verification.status === 'FAILED'
                    ? 'tone-red'
                    : 'tone-gray'
              }`}
            >
              {placement.verification.status === 'PASSED'
                ? '✓ Проверка пройдена'
                : placement.verification.status === 'FAILED'
                  ? '✕ Проверка не пройдена'
                  : 'Ожидает проверки'}
            </span>
            <span className="text-tertiary">
              {formatDateTime(placement.verification.checkedAt)}
            </span>
          </div>
          {placement.verification.failureReason !== null && (
            <div className="text-secondary mt-8" style={{ fontSize: 12.5 }}>
              {placement.verification.failureReason}
            </div>
          )}
          {placement.evidence.length > 0 && (
            <div className="evidence-list">
              {placement.evidence.map((entry) => (
                <EvidenceRow key={entry.id} type={entry.type} payload={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EvidenceRow({
  type,
  payload,
}: {
  type: string;
  payload: { metadata: Record<string, unknown> | null; url: string | null; content: string | null };
}) {
  const metadata = payload.metadata ?? {};
  const matched =
    type === 'COMPANY_MATCH' || type === 'WEBSITE_MATCH' || type === 'BACKLINK_MATCH'
      ? metadata.matched
      : null;

  return (
    <div className="evidence-item">
      <span>
        {EVIDENCE_LABELS[type as EvidenceType] ?? type}
        {matched === true ? ' — совпадение подтверждено ✓' : ''}
        {matched === false ? ' — без совпадения' : ''}
      </span>
      {payload.url !== null && (
        <a href={payload.url} target="_blank" rel="noreferrer">
          {payload.url}
        </a>
      )}
    </div>
  );
}

function ManualCompletionForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (payload: { externalId: string; liveUrl: string; notes?: string }) => Promise<void>;
}) {
  const [externalId, setExternalId] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [notes, setNotes] = useState('');

  const submit = (payload: { externalId: string; liveUrl: string; notes?: string }) => {
    void onSubmit({
      externalId: payload.externalId,
      liveUrl: payload.liveUrl,
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
    });
  };

  return (
    <form
      className="form mt-16"
      onSubmit={(event) => {
        event.preventDefault();
        submit({
          externalId,
          liveUrl,
          ...(notes === '' ? {} : { notes }),
        });
      }}
    >
      <div className="field">
        <label className="field-label" htmlFor="external-id">
          Внешний идентификатор (обязательно)
        </label>
        <input
          id="external-id"
          className="input"
          value={externalId}
          onChange={(event) => setExternalId(event.target.value)}
          placeholder="например: inmyroom/nordhaus"
          required
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="live-url">
          Публичный URL (обязательно)
        </label>
        <input
          id="live-url"
          className="input"
          value={liveUrl}
          onChange={(event) => setLiveUrl(event.target.value)}
          placeholder="https://…"
          required
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="manual-notes">
          Комментарий
        </label>
        <input
          id="manual-notes"
          className="input"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="например: профиль одобрен редактором"
        />
      </div>
      <div className="flex">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          Подтвердить публикацию
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => setNotes('')}
          disabled={busy}
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
