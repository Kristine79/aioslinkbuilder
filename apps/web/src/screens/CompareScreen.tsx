/**
 * Сравнение доноров — compare several opportunities side by side and show a
 * deterministic recommendation with an explanation of why the top one is best.
 *
 * The screen is honest about the campaign state:
 * — площадки ещё не найдены  → «Сравнение пока недоступно» + CTA на поиск;
 * — поиск выполнен без результатов → «Нет площадок для сравнения» + CTA;
 * — площадки есть → список реальных возможностей текущей кампании.
 * The selection is limited to 2–4 donors; the data always comes from the
 * backend for the active campaign (no demo fixtures, restored on refresh).
 * The search-has-run decision comes from the persisted server state, not
 * from sessionStorage or the audit trail.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import type { ComparisonResultDto, OpportunityDto } from '../api/types';
import { ErrorState, LoadingState } from '../components/ui';
import { useDiscoveryState } from '../discoveryState';
import {
  METHOD_LABELS,
  PROVIDER_TYPE_LABELS,
  RISK_LEVEL_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from '../ru';

const MAX_SELECTED = 4;
const MIN_SELECTED = 2;

export function CompareScreen() {
  const [items, setItems] = useState<OpportunityDto[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonResultDto | null>(null);
  const { hasRun: discoveryHasRan, refresh: refreshDiscovery } = useDiscoveryState();

  const load = useCallback(() => {
    setError(null);
    api
      .opportunities({})
      .then((result) => {
        setItems(result.items);
        if (result.items.length > 1) {
          setSelected(new Set(result.items.slice(0, 2).map((item) => item.id)));
        } else {
          setSelected(new Set());
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    refreshDiscovery();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= MAX_SELECTED) return;
      next.add(id);
    }
    setSelected(next);
    setComparison(null);
  };

  const runCompare = useCallback(() => {
    const ids = [...selected];
    if (ids.length < MIN_SELECTED) return;
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

  if (items.length === 0) {
    return (
      <div>
        <h1 className="page-title">Сравнение доноров</h1>
        <p className="page-subtitle">
          Сравните качество 2–4 площадок и поймите, почему система рекомендует одну из них.
        </p>
        <div className="state-box">
          <div className="state-box-icon">⇆</div>
          <div className="state-box-title">
            {discoveryHasRan ? 'Нет площадок для сравнения' : 'Сравнение пока недоступно'}
          </div>
          <div className="state-box-hint">
            {discoveryHasRan
              ? 'По текущей стратегии подходящих возможностей пока не найдено.'
              : 'Сначала найдите площадки для этой кампании. После этого здесь можно будет сравнить 2–4 донора.'}
          </div>
          <div className="state-actions">
            <Link className="btn btn-primary mt-16" to="/opportunities?discover=1">
              {discoveryHasRan ? 'Повторить поиск' : 'Найти площадки →'}
            </Link>
            {discoveryHasRan && (
              <Link className="btn btn-secondary mt-16" to="/company">
                Изменить стратегию
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between">
        <div>
          <h1 className="page-title">Сравнение доноров</h1>
          <p className="page-subtitle">
            Выберите {MIN_SELECTED}–{MAX_SELECTED} площадки, чтобы сравнить их качество и понять,
            почему система рекомендует одну из них.
          </p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          disabled={selectedItems.length < MIN_SELECTED}
          onClick={runCompare}
        >
          Сравнить выбранные{selectedItems.length > 0 ? ` · ${selectedItems.length}` : ''}
        </button>
      </div>

      {selectedItems.length >= MAX_SELECTED && (
        <div className="text-tertiary mt-8" style={{ fontSize: 12.5 }}>
          Можно выбрать не более {MAX_SELECTED} площадок.
        </div>
      )}

      <div className="list mb-16 mt-16">
        {items.map((item) => {
          const isDemoProvider =
            item.provider?.type === 'MOCK' ||
            item.placements.some((p) => p.providerType === 'MOCK');
          const disabled = !selected.has(item.id) && selectedItems.length >= MAX_SELECTED;
          return (
            <label
              className={`row compare-row ${disabled ? 'compare-row-disabled' : ''}`}
              key={item.id}
            >
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                disabled={disabled}
                onChange={() => toggle(item.id)}
                aria-label={`Выбрать ${item.platformName}`}
              />
              <div className="row-main">
                <div className="row-title">
                  <Link to={`/opportunities/${item.id}`}>{item.platformName}</Link>
                  <span className="badge tone-gray">
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                  {isDemoProvider && <span className="chip chip-demo">Демо</span>}
                </div>
                <div className="row-sub">
                  <span>{TYPE_LABELS[item.placementType] ?? item.placementType}</span>
                  <span className="chip">
                    {METHOD_LABELS[item.placementMethod] ?? item.placementMethod}
                  </span>
                  {item.donorQualityScore !== null && (
                    <span className="chip">донор {item.donorQualityScore} / 100</span>
                  )}
                  {item.risk !== null && (
                    <span className="chip">
                      риск: {RISK_LEVEL_LABELS[item.risk.level] ?? item.risk.level}
                    </span>
                  )}
                  {item.provider !== null && (
                    <span className="text-tertiary" style={{ fontSize: 12 }}>
                      {item.provider.name}
                      {isDemoProvider
                        ? ` · ${PROVIDER_TYPE_LABELS[item.provider.type] ?? 'демо'}`
                        : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="row-side">
                <span className="score-value">{item.overallScore ?? item.score ?? '—'}</span>
                <span className="score-caption">
                  {item.overallScore !== null ? 'оценка 2.0' : 'балл'}
                </span>
              </div>
            </label>
          );
        })}
      </div>

      {selectedItems.length < MIN_SELECTED && (
        <div className="text-tertiary" style={{ fontSize: 12.5 }}>
          Выберите как минимум {MIN_SELECTED} площадки, чтобы сравнить их.
        </div>
      )}

      {comparison !== null && comparison.items.length > 1 && (
        <div className="mt-24">
          {comparison.recommendation !== null && (
            <div className="compare-recommendation mb-16">
              <strong>Почему рекомендуется №1</strong>
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
                  render={(v) =>
                    v === null ? '—' : typeof v === 'string' ? (RISK_LEVEL_LABELS[v] ?? v) : '—'
                  }
                />
                <Row
                  label="Орг. трафик"
                  values={comparison.items.map((r) => r.traffic)}
                  render={(v) =>
                    typeof v === 'number' ? new Intl.NumberFormat('ru-RU').format(v) : '—'
                  }
                />
                <Row label="Авторитетность" values={comparison.items.map((r) => r.authority)} />
                <Row
                  label="География"
                  values={comparison.items.map((r) => r.geographicRelevance)}
                />
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
