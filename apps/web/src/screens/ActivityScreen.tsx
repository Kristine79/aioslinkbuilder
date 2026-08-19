/**
 * Экран активности — проверки и журнал аудита, разделённые на два блока.
 * Placement status and verification status are two distinct signals:
 * a placement can be PUBLISHED with verification still PENDING, and
 * only a passed check moves the placement to VERIFIED.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../api/client';
import type { ActivityDto } from '../api/types';
import { ErrorState, LoadingState, StatusBadge, VerificationBadge } from '../components/ui';
import { HelpTip } from '../components/HelpTip';
import { AUDIT_ACTION_LABELS, AUDIT_FILTER_LABELS, EVIDENCE_LABELS, formatDateTime } from '../ru';

type AuditFilter = 'all' | 'placements' | 'opportunities' | 'analysis' | 'errors' | 'manual';

const AUDIT_FILTERS: readonly AuditFilter[] = [
  'all',
  'placements',
  'opportunities',
  'analysis',
  'errors',
  'manual',
];

function matchesAuditFilter(filter: AuditFilter, entry: ActivityDto['audit'][number]): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'placements':
      return entry.entityType === 'Placement';
    case 'opportunities':
      return entry.entityType === 'PlacementOpportunity';
    case 'analysis':
      return entry.action === 'COMPANY_ANALYZED' || entry.action === 'OPPORTUNITY_CLASSIFIED';
    case 'errors':
      return (
        entry.action === 'PLACEMENT_FAILED' || entry.action === 'PLACEMENT_VERIFICATION_FAILED'
      );
    case 'manual':
      return (
        entry.action === 'PLACEMENT_NEEDS_MANUAL' || entry.action === 'PLACEMENT_MANUALLY_PUBLISHED'
      );
  }
}

export function ActivityScreen() {
  const [data, setData] = useState<ActivityDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AuditFilter>('all');

  const load = useCallback(() => {
    setError(null);
    api
      .activity()
      .then(setData)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredAudit = useMemo(
    () => data?.audit.filter((entry) => matchesAuditFilter(filter, entry)) ?? [],
    [data, filter],
  );

  if (data === null && error === null) {
    return <LoadingState text="Загружаем журнал…" />;
  }
  if (data === null) {
    return <ErrorState message={error ?? 'Неизвестная ошибка'} onRetry={load} />;
  }

  return (
    <div>
      <h1 className="page-title">Проверка и журнал</h1>
      <p className="page-subtitle">
        Проверки с доказательствами и полный журнал действий — от поиска площадок до верификации
      </p>

      <div className="grid">
        <div className="card">
          <h2 className="card-title">
            Проверки ({data.verifications.length}){' '}
            <HelpTip
              text="Каждая проверка подтверждает, что размещение реально существует, и сохраняет доказательства. «Опубликовано» ≠ «Проверено»."
              align="right"
            />
          </h2>
          {data.verifications.length === 0 ? (
            <div className="empty-note">
              Проверок пока нет — запустите размещение и проверьте его.
            </div>
          ) : (
            <div className="verification-list">
              {data.verifications.map((item) => (
                <div className="verification-row" key={item.id}>
                  <div className="flex" style={{ gap: 8 }}>
                    <VerificationBadge status={item.verificationStatus} />
                    <StatusBadge status={item.placementStatus} />
                  </div>
                  <div className="row-sub mt-8">
                    <span>{item.platformName}</span>
                    {item.platformUrl !== null && (
                      <a href={item.platformUrl} target="_blank" rel="noreferrer">
                        {item.platformUrl}
                      </a>
                    )}
                    <span className="text-tertiary">
                      {item.checkedAt !== null ? formatDateTime(item.checkedAt) : '—'}
                    </span>
                  </div>
                  {item.failureReason !== null && (
                    <div className="text-secondary mt-8" style={{ fontSize: 12.5 }}>
                      {item.failureReason}
                    </div>
                  )}
                  {item.evidence.length > 0 && (
                    <div className="evidence-list mt-8">
                      {item.evidence.map((entry) => (
                        <div className="evidence-item" key={entry.id}>
                          <span className="chip">{EVIDENCE_LABELS[entry.type] ?? entry.type}</span>
                          {entry.url !== null && (
                            <a href={entry.url} target="_blank" rel="noreferrer">
                              {entry.url}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ flex: 1 }}>
              Журнал аудита ({data.audit.length})
            </h2>
          </div>
          <div className="filter-tabs">
            {AUDIT_FILTERS.map((entry) => (
              <button
                key={entry}
                type="button"
                className={`filter-tab ${filter === entry ? 'active' : ''}`}
                onClick={() => setFilter(entry)}
              >
                {AUDIT_FILTER_LABELS[entry]}
              </button>
            ))}
          </div>
          {filteredAudit.length === 0 ? (
            <div className="empty-note">Событий по выбранному фильтру нет.</div>
          ) : (
            <div className="audit-list">
              {filteredAudit.map((entry) => (
                <div className="audit-row" key={entry.id}>
                  <span className="audit-time">{formatDateTime(entry.timestamp)}</span>
                  <span className="audit-action">
                    {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span className="audit-meta mono">{entry.entityType}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
