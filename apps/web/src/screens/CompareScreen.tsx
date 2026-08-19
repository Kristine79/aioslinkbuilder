/**
 * Сравнение доноров — compare several opportunities side by side and show a
 * deterministic recommendation with an explanation of why the top one is best.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import type { ComparisonResultDto, OpportunityDto } from '../api/types';
import { ErrorState, LoadingState } from '../components/ui';
import { METHOD_LABELS, RISK_LEVEL_LABELS, STATUS_LABELS, TYPE_LABELS } from '../ru';

export function CompareScreen() {
  const [items, setItems] = useState<OpportunityDto[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonResultDto | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .opportunities({})
      .then((result) => {
        setItems(result.items);
        if (result.items.length > 0) {
          setSelected(new Set(result.items.slice(0, 2).map((item) => item.id)));
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setComparison(null);
  };

  const runCompare = useCallback(() => {
    const ids = [...selected];
    if (ids.length < 2) return;
    setError(null);
    api
      .compare(ids)
      .then(setComparison)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [selected]);

  const selectedItems = useMemo(
    () => (items ?? []).filter((item) => selected.has(item.id)),
    [items, selected],
  );

  if (items === null && error === null) {
    return <LoadingState text="Загружаем площадки…" />;
  }
  if (items === null) {
    return <ErrorState message={error ?? 'Неизвестная ошибка'} onRetry={load} />;
  }

  return (
    <div>
      <h1 className="page-title">Сравнение доноров</h1>
      <p className="page-subtitle">
        Выберите 2–4 площадки, чтобы сравнить их качество и понять, почему AI рекомендует одну из них.
      </p>

      {selectedItems.length < 2 && (
        <div className="mb-16">
          <div className="empty-note">Выберите как минимум 2 площадки.</div>
        </div>
      )}

      <div className="list mb-16">
        {items.map((item) => (
          <label className="row compare-row" key={item.id}>
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => toggle(item.id)}
            />
            <div className="row-main">
              <div className="row-title">
                <Link to={`/opportunities/${item.id}`}>{item.platformName}</Link>
                <span className="badge tone-gray">{STATUS_LABELS[item.status] ?? item.status}</span>
              </div>
              <div className="row-sub">
                <span>{TYPE_LABELS[item.placementType] ?? item.placementType}</span>
                <span className="chip">{METHOD_LABELS[item.placementMethod] ?? item.placementMethod}</span>
                {item.donorQualityScore !== null && (
                  <span className="chip">донор: {item.donorQualityScore}</span>
                )}
                {item.risk !== null && (
                  <span className="chip">риск: {RISK_LEVEL_LABELS[item.risk.level] ?? item.risk.level}</span>
                )}
              </div>
            </div>
            <div className="row-side">
              <span className="score-value">{item.overallScore ?? item.score ?? '—'}</span>
            </div>
          </label>
        ))}
      </div>

      <button
        className="btn btn-primary"
        type="button"
        disabled={selectedItems.length < 2}
        onClick={runCompare}
      >
        Сравнить ({selectedItems.length})
      </button>

      {comparison !== null && comparison.items.length > 1 && (
        <div className="mt-24">
          {comparison.recommendation !== null && (
            <div className="compare-recommendation mb-16">
              <strong>Почему AI рекомендует №1</strong>
              <div>{comparison.recommendation.reason}</div>
            </div>
          )}
          <div className="table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Показатель</th>
                  {comparison.items.map((row) => (
                    <th key={row.id}>
                      {row.platformName}
                      {comparison.recommendation?.winnerId === row.id && ' ✓'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row label="Оценка (база)" values={comparison.items.map((r) => r.score)} />
                <Row label="Оценка 2.0" values={comparison.items.map((r) => r.overall)} />
                <Row label="Качество донора" values={comparison.items.map((r) => r.donorQuality)} />
                <Row
                  label="Риск"
                  values={comparison.items.map((r) => r.risk)}
                  render={(v) => (v === null ? '—' : typeof v === 'string' ? (RISK_LEVEL_LABELS[v] ?? v) : '—')}
                />
                <Row
                  label="Орг. трафик"
                  values={comparison.items.map((r) => r.traffic)}
                  render={(v) => (typeof v === 'number' ? new Intl.NumberFormat('ru-RU').format(v) : '—')}
                />
                <Row label="Авторитетность" values={comparison.items.map((r) => r.authority)} />
                <Row label="География" values={comparison.items.map((r) => r.geographicRelevance)} />
                <Row
                  label="Тип размещения"
                  values={comparison.items.map((r) => r.placementType)}
                  render={(v) => (typeof v === 'string' ? (TYPE_LABELS[v] ?? v) : '—')}
                />
                <Row
                  label="Способ"
                  values={comparison.items.map((r) => r.placementMethod)}
                  render={(v) => (typeof v === 'string' ? (METHOD_LABELS[v] ?? v) : '—')}
                />
                <Row
                  label="Усилия"
                  values={comparison.items.map((r) => r.effort)}
                  render={(v) =>
                    typeof v === 'number'
                      ? (['Низкие', 'Средние', 'Высокие', 'Очень высокие'][v] ?? '—')
                      : '—'
                  }
                />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  values,
  render,
}: {
  label: string;
  values: Array<number | string | null>;
  render?: (value: number | string | null) => string;
}) {
  return (
    <tr>
      <td className="compare-label">{label}</td>
      {values.map((value, i) => (
        <td key={i}>
          {render !== undefined ? render(value) : value === null ? '—' : String(value)}
        </td>
      ))}
    </tr>
  );
}
