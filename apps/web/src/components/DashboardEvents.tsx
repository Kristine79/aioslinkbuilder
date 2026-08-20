/**
 * «Последние события» — user-facing activity feed. Each entry is presented
 * as a useful result («План размещений сформирован · 10 возможностей ·
 * 4 рекомендованы») instead of the raw backend log; the timestamp is
 * secondary. Identical consecutive entries are collapsed, so the feed never
 * repeats the same line visually.
 */

import { Link } from 'react-router-dom';

import type { AuditEventDto, OpportunityDto } from '../api/types';
import { AUDIT_ACTION_LABELS, formatDateTime, pluralRu } from '../ru';

interface PresentedEvent {
  title: string;
  sub: string | null;
}

function findPlatformByMeta(
  metadata: Readonly<Record<string, unknown>>,
  opportunityById: Map<string, OpportunityDto>,
): string | null {
  if (typeof metadata.platformId !== 'string') return null;
  for (const opportunity of opportunityById.values()) {
    if (opportunity.platformId === metadata.platformId) return opportunity.platformName;
  }
  return null;
}

function presentEvent(
  entry: AuditEventDto,
  opportunityById: Map<string, OpportunityDto>,
): PresentedEvent {
  const metadata = entry.metadata ?? {};
  const opportunity = opportunityById.get(entry.entityId);
  const platform =
    opportunity?.platformName ?? findPlatformByMeta(metadata, opportunityById) ?? null;

  if (entry.action === 'PLACEMENT_PLAN_GENERATED') {
    if (metadata.status !== 'COMPLETE') {
      return {
        title: 'План размещений: ошибка',
        sub: typeof metadata.reason === 'string' && metadata.reason !== '' ? metadata.reason : null,
      };
    }
    const total = typeof metadata.opportunityCount === 'number' ? metadata.opportunityCount : null;
    const recommended = typeof metadata.recommended === 'number' ? metadata.recommended : null;
    const parts = [
      total !== null
        ? `${total} ${pluralRu(total, 'возможность', 'возможности', 'возможностей')}`
        : null,
      recommended !== null
        ? `${recommended} ${pluralRu(recommended, 'рекомендована', 'рекомендованы', 'рекомендованы')}`
        : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' · ');
    return {
      title: 'План размещений сформирован',
      sub: parts === '' ? null : parts,
    };
  }

  if (entry.action === 'OPPORTUNITY_CLASSIFIED') {
    const score =
      typeof metadata.score === 'number' ? metadata.score : (opportunity?.score ?? null);
    const parts = [platform, score !== null ? `балл ${score}` : null]
      .filter((part): part is string => part !== null)
      .join(' · ');
    return {
      title: 'Возможность оценена',
      sub: parts === '' ? null : parts,
    };
  }

  return {
    title: AUDIT_ACTION_LABELS[entry.action] ?? entry.action,
    sub: platform,
  };
}

export function DashboardEvents({
  events,
  opportunityById,
}: {
  events: AuditEventDto[];
  opportunityById: Map<string, OpportunityDto>;
}) {
  const rows: Array<{ entry: AuditEventDto } & PresentedEvent> = [];
  let lastSignature: string | null = null;
  for (const entry of events) {
    const presented = presentEvent(entry, opportunityById);
    const signature = `${entry.action}|${presented.sub ?? ''}`;
    if (signature === lastSignature) continue;
    lastSignature = signature;
    rows.push({ entry, ...presented });
    if (rows.length >= 7) break;
  }

  return (
    <section className="card">
      <div className="card-header">
        <div className="card-title" style={{ flex: 1 }}>
          Последние события
        </div>
        <Link to="/activity" className="text-secondary" style={{ fontSize: 12.5 }}>
          Весь журнал
        </Link>
      </div>
      <div className="card-body">
        {rows.length === 0 ? (
          <div className="dash-empty">
            <span className="dash-empty-icon">◌</span>
            <div>
              <div className="dash-empty-title">Событий пока нет</div>
              <div className="dash-empty-hint">
                Действия системы появятся здесь — например, после поиска площадок.
              </div>
            </div>
          </div>
        ) : (
          <div className="event-list">
            {rows.map((row) => (
              <div className="event-row" key={row.entry.id}>
                <span className="event-time">{formatDateTime(row.entry.timestamp)}</span>
                <div className="event-main">
                  <div className="event-title">{row.title}</div>
                  {row.sub !== null && <div className="event-sub">{row.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
