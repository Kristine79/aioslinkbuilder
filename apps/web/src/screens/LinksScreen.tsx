/**
 * Ссылки и анкор-профиль — campaign-level link view: anchors, anchor types,
 * placement types, donor domains, status and verified links. The data comes
 * from the backend (intel prepared per opportunity); no business logic here.
 * In demo mode all values are labeled synthetic.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import type { OpportunityDto } from '../api/types';
import { ErrorState, LoadingState } from '../components/ui';
import { ANCHOR_TYPE_LABELS, STATUS_LABELS, TYPE_LABELS } from '../ru';

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

  const rows = useMemo(() => {
    return (items ?? []).flatMap((item) => {
      const anchor = item.anchorStrategy?.anchor ?? item.linkInsert?.anchor ?? null;
      const anchorType = item.anchorStrategy?.anchorType ?? null;
      const verified = item.placements.some((p) => p.status === 'VERIFIED');
      const liveUrl = item.placements.find((p) => p.status === 'VERIFIED')?.liveUrl ?? null;
      const anchorCount = 1;
      return {
        platformName: item.platformName,
        platformUrl: item.platformUrl,
        opportunityId: item.id,
        placementType: item.placementType,
        status: item.status,
        anchor,
        anchorType,
        verified,
        liveUrl,
        anchorCount,
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
      <div className="text-tertiary" style={{ fontSize: 12, marginBottom: 12 }}>
        Данные синтетические (демо). Анкор-профиль компании пока не подключён — распределение анкоров
        приведено без ссылки на историю кампании.
      </div>

      <div className="stat-grid mt-16">
        <div className="stat">
          <div className="stat-value">{rows.length}</div>
          <div className="stat-label">Возможностей</div>
        </div>
        <div className="stat">
          <div className="stat-value">{verifiedCount}</div>
          <div className="stat-label">Проверенных ссылок</div>
        </div>
        <div className="stat">
          <div className="stat-value">{distribution.length}</div>
          <div className="stat-label">Типов анкоров</div>
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
        </div>
        <div className="card-body">
          <div className="table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Донор</th>
                  <th>Тип</th>
                  <th>Анкор</th>
                  <th>Тип анкора</th>
                  <th>Статус</th>
                  <th>Ссылка</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <Link to={`/opportunities/${row.opportunityId}`}>{row.platformName}</Link>
                    </td>
                    <td>{TYPE_LABELS[row.placementType] ?? row.placementType}</td>
                    <td className="anchor-cell">{row.anchor ?? '—'}</td>
                    <td>
                      {row.anchorType !== null ? (ANCHOR_TYPE_LABELS[row.anchorType] ?? row.anchorType) : '—'}
                    </td>
                    <td>
                      <span className="badge tone-gray">{STATUS_LABELS[row.status] ?? row.status}</span>
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
        </div>
      </div>
    </div>
  );
}
