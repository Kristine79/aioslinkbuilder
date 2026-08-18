/**
 * Детали возможности — execution lifecycle.
 * Shows the opportunity (score, recommendation, provider, capabilities) and
 * every placement attempt with state-gated actions. All transitions go
 * through the backend use cases; the UI only offers what the backend
 * reports as allowed for the current state.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../api/client';
import type { OpportunityDto, PlacementDto } from '../api/types';
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
import {
  ACTION_LABELS,
  CAPABILITY_LABELS,
  METHOD_LABELS,
  PROVIDER_TYPE_LABELS,
  TYPE_LABELS,
  formatDateTime,
} from '../ru';

export function OpportunityScreen() {
  const { id } = useParams<{ id: string }>();
  const [opportunity, setOpportunity] = useState<OpportunityDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (id === undefined) return;
    setError(null);
    api
      .opportunity(id)
      .then(setOpportunity)
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

  if (opportunity === null && error === null) {
    return <LoadingState text="Загружаем возможность…" />;
  }
  if (opportunity === null) {
    return <ErrorState message={error ?? 'Неизвестная ошибка'} onRetry={load} />;
  }

  const canRequestManual = opportunity.allowedActions.includes('requestManual');
  const canExecute = opportunity.allowedActions.includes('execute');
  const canApprove = opportunity.allowedActions.includes('approve');

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
          <Card title="Данные площадки">
            <div className="kv">
              <span className="kv-key">Платформа</span>
              <span className="kv-value">{opportunity.platformName}</span>
            </div>
            <div className="kv">
              <span className="kv-key">Страна</span>
              <span className="kv-value">{opportunity.country ?? '—'}</span>
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
          <Card title="Рекомендация AI">
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

          <Card
            title="Исполнение"
            actions={
              <span className="chip">
                {opportunity.provider !== null
                  ? `${opportunity.provider.name} · ${
                      PROVIDER_TYPE_LABELS[opportunity.provider.type] ?? opportunity.provider.type
                    }`
                  : 'провайдер не выбран'}
              </span>
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
          title="Размещения (попытки)"
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
              {opportunity.placements.map((placement) => (
                <PlacementAttempt
                  key={placement.id}
                  placement={placement}
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
    </div>
  );
}

function PlacementAttempt({
  placement,
  busy,
  onAction,
}: {
  placement: PlacementDto;
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

  return (
    <div className={`timeline-item ${attemptClass}`}>
      <div className="flex-between">
        <div className="flex">
          <StatusBadge status={placement.status} />
          <span className="text-secondary" style={{ fontSize: 13 }}>
            {placement.providerName ?? '—'}
          </span>
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
  const summary =
    type === 'COMPANY_MATCH' || type === 'WEBSITE_MATCH' || type === 'BACKLINK_MATCH'
      ? metadata.matched === true
        ? 'совпадение подтверждено'
        : metadata.matched === false
          ? 'без совпадения'
          : null
      : null;
  return (
    <div className="evidence-item">
      <span>{summary ?? '·'}</span>
      <span className="chip">{type}</span>
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
