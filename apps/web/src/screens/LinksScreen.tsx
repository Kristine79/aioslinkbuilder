/**
 * Ссылки и анкор-профиль — campaign-level link view: anchors, anchor types,
 * placement types, donor domains, status and verified links. The data comes
 * from the backend (intel prepared per opportunity); no business logic here.
 *
 * This screen is the OUTPUT of the placement workflow
 * (DISCOVER → … → PLACE → VERIFY): a link appears here only after a placement
 * was executed and verified. The table intentionally lists only opportunities
 * that already have placement records — NOT the raw opportunity list.
 * MOCK/SYNTHETIC placements are always labeled «Демо», even when their status
 * is PUBLISHED or VERIFIED.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import type { OpportunityDto, PlacementStatus } from '../api/types';
import { ErrorState, LoadingState, StatusBadge } from '../components/ui';
import { ANCHOR_TYPE_LABELS, pluralRu, TYPE_LABELS } from '../ru';

interface LinkRow {
  opportunityId: string;
  platformName: string;
  platformUrl: string | null;
  placementType: string;
  placementStatus: PlacementStatus;
  anchor: string | null;
  anchorType: string | null;
  verified: boolean;
  liveUrl: string | null;
  isDemoProvider: boolean;
}

export function LinksScreen() {
  const [items, setItems] = useState<OpportunityDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .opportunities({})
      .then((result) => setItems(result.items))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo<LinkRow[]>(() => {
    return (items ?? []).flatMap((item) => {
      // A link appears here only when the opportunity already has a placement
      // record (submitted, published, verified, failed attempts, manual…).
      const placements = item.placements;
      if (placements.length === 0) return [];
      const latest = placements[placements.length - 1];
      if (latest === undefined) return [];
      const verifiedPlacement = placements.find((p) => p.status === 'VERIFIED');
      const anchorStrategy = item.anchorStrategy;
      const linkInsert = item.linkInsert;
      const anchor = anchorStrategy?.anchor ?? linkInsert?.anchor ?? null;
      const anchorType = anchorStrategy?.anchorType ?? null;
      return {
        opportunityId: item.id,
        platformName: item.platformName,
        platformUrl: item.platformUrl,
        placementType: item.placementType,
        placementStatus: latest.status,
        anchor,
        anchorType,
        verified: verifiedPlacement !== undefined,
        liveUrl: verifiedPlacement?.liveUrl ?? null,
        isDemoProvider: placements.some((p) => p.providerType === 'MOCK'),
      };
    });
  }, [items]);

  const distribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.anchorType === null) continue;
      map.set(row.anchorType, (map.get(row.anchorType) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const verifiedCount = rows.filter((row) => row.verified).length;
  const hasPlacements = rows.length > 0;
  const hasVerifiedLinks = verifiedCount > 0;

  if (items === null && error === null) {
    return <LoadingState text="Загружаем ссылки…" />;
  }
  if (items === null) {
    return <ErrorState message={error ?? 'Неизвестная ошибка'} onRetry={load} />;
  }

  return (
    <div>
      <h1 className="page-title">Ссылки и анкор-профиль</h1>
      <p className="page-subtitle">
        Кампания в целом: анкоры, типы размещений, доноры и проверенные ссылки.
      </p>
      <div className="text-tertiary" style={{ fontSize: 12, marginBottom: 4 }}>
        Ссылка появляется здесь после выполнения и проверки размещения.
      </div>

      <div className="stat-grid mt-16">
        <div className="stat">
          <div className="stat-value">{items.length}</div>
          <div className="stat-label">Возможностей</div>
          <div className="stat-hint">
            {items.length === 0
              ? 'Для кампании пока нет найденных площадок.'
              : `размещено: ${rows.length} ${pluralRu(rows.length, 'площадка', 'площадки', 'площадок')}`}
          </div>
        </div>
        <div className="stat">
          <div className="stat-value">{verifiedCount}</div>
          <div className="stat-label">Проверенных ссылок</div>
          <div className="stat-hint">
            {hasPlacements && !hasVerifiedLinks
              ? 'Размещения есть, но проверка ещё не выполнена.'
              : 'Ссылки, подтверждённые проверкой.'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-value">{distribution.length}</div>
          <div className="stat-label">Типов анкоров</div>
          <div className="stat-hint">
            {distribution.length === 0
              ? 'Анкоры появятся после подготовки вставки ссылки.'
              : 'По подготовленным рекомендациям анкоров.'}
          </div>
        </div>
      </div>

      {distribution.length > 0 && (
        <div className="card mt-16">
          <div className="card-header">
            <div className="card-title">Распределение анкоров (по рекомендуемым)</div>
          </div>
          <div className="card-body">
            <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
              {distribution.map(([type, count]) => (
                <span className="chip" key={type}>
                  {ANCHOR_TYPE_LABELS[type] ?? type}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card mt-16">
        <div className="card-header">
          <div className="card-title">Ссылки по площадкам</div>
          {hasVerifiedLinks && <StatusBadge status="VERIFIED" />}
        </div>
        <div className="card-body">
          {!hasPlacements ? (
            <div className="state-box">
              <div className="state-box-icon">⌁</div>
              <div className="state-box-title">Пока нет размещённых ссылок</div>
              <div className="state-box-hint">
                Здесь появятся доноры, анкоры, типы размещений и статусы после выполнения и проверки
                размещений. После проверки ссылка появится здесь автоматически.
              </div>
              <div className="state-actions">
                <Link className="btn btn-primary mt-16" to="/opportunities?discover=1">
                  Найти площадки →
                </Link>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Донор</th>
                    <th>Тип</th>
                    <th>Анкор</th>
                    <th>Тип анкора</th>
                    <th>Статус размещения</th>
                    <th>Ссылка</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.opportunityId}>
                      <td>
                        <Link to={`/opportunities/${row.opportunityId}`}>{row.platformName}</Link>
                        {row.platformUrl !== null && (
                          <div className="text-tertiary" style={{ fontSize: 11.5 }}>
                            {row.platformUrl}
                          </div>
                        )}
                      </td>
                      <td>{TYPE_LABELS[row.placementType] ?? row.placementType}</td>
                      <td className="anchor-cell">{row.anchor ?? '—'}</td>
                      <td>
                        {row.anchorType !== null
                          ? (ANCHOR_TYPE_LABELS[row.anchorType] ?? row.anchorType)
                          : '—'}
                      </td>
                      <td>
                        <div
                          className="flex"
                          style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
                        >
                          <StatusBadge status={row.placementStatus} />
                          {row.isDemoProvider && <span className="chip chip-demo">Демо</span>}
                          {row.verified && (
                            <span className="chip tone-green">ссылка проверена</span>
                          )}
                        </div>
                        {row.isDemoProvider && (
                          <div className="text-tertiary" style={{ fontSize: 11.5 }}>
                            размещение выполнено демо-провайдером — это не реальная публикация
                          </div>
                        )}
                      </td>
                      <td>
                        {row.verified && row.liveUrl !== null ? (
                          <a href={row.liveUrl} target="_blank" rel="noreferrer">
                            {row.liveUrl}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
