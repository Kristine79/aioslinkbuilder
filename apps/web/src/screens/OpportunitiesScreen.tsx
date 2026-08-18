/**
 * Возможности — the primary product screen.
 * Ranked list of AI-found placements with score, recommendation, provider,
 * execution method and status. Filters (category/method/status/min score)
 * are applied server-side; the backend ranks by score.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { api } from '../api/client';
import type { CategoryDto, OpportunityDto } from '../api/types';
import { Chip, ChipList, ErrorState, LoadingState, StatusBadge } from '../components/ui';
import { ScoreBadge } from '../components/Score';
import { ACTION_LABELS, CAPABILITY_LABELS, METHOD_LABELS, STATUS_LABELS, TYPE_LABELS } from '../ru';

function useOpportunities() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<OpportunityDto[] | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const category = searchParams.get('category') ?? undefined;
    const method = searchParams.get('method') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const minScoreRaw = searchParams.get('minScore');
    const minScore = minScoreRaw === null ? undefined : Number(minScoreRaw);
    return {
      ...(category !== undefined ? { category } : {}),
      ...(method !== undefined ? { method } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(minScore !== undefined ? { minScore } : {}),
    };
  }, [searchParams]);

  const load = useCallback(() => {
    setError(null);
    Promise.all([api.opportunities(query), api.meta()])
      .then(([result, meta]) => {
        setItems(result.items);
        setCategories(meta.categories);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, categories, error, load, query };
}

export function OpportunitiesScreen() {
  const { items, categories, error, load, query } = useOpportunities();
  const [, setSearchParams] = useSearchParams();

  const updateFilter = (name: string, value: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === '' || value === 'all') {
        next.delete(name);
      } else {
        next.set(name, value);
      }
      return next;
    });
  };

  const methodOptions = useMemo(
    () => [...new Set(items?.map((item) => item.placementMethod) ?? [])],
    [items],
  );
  const statusOptions = useMemo(
    () => [...new Set(items?.map((item) => item.status) ?? [])],
    [items],
  );

  return (
    <div>
      <h1 className="page-title">Возможности размещения</h1>
      <p className="page-subtitle">
        AI нашёл площадки: почему они релевантны, насколько подходят и как их запустить
      </p>

      <div className="filters mt-16">
        <select
          className="select filter-select"
          value={query.category ?? 'all'}
          onChange={(event) => updateFilter('category', event.target.value)}
          aria-label="Категория"
        >
          <option value="all">Все категории</option>
          {categories.map((category) => (
            <option key={category.id} value={category.code}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          className="select filter-select"
          value={query.method ?? 'all'}
          onChange={(event) => updateFilter('method', event.target.value)}
          aria-label="Способ выполнения"
        >
          <option value="all">Все способы</option>
          {methodOptions.map((option) => (
            <option key={option} value={option}>
              {METHOD_LABELS[option] ?? option}
            </option>
          ))}
        </select>
        <select
          className="select filter-select"
          value={query.status ?? 'all'}
          onChange={(event) => updateFilter('status', event.target.value)}
          aria-label="Статус"
        >
          <option value="all">Все статусы</option>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABELS[option] ?? option}
            </option>
          ))}
        </select>
        <select
          className="select filter-min-score"
          value={query.minScore === undefined ? 'all' : String(query.minScore)}
          onChange={(event) => updateFilter('minScore', event.target.value)}
          aria-label="Минимальный балл"
        >
          <option value="all">Любой балл</option>
          <option value="90">≥ 90</option>
          <option value="85">≥ 85</option>
          <option value="80">≥ 80</option>
          <option value="70">≥ 70</option>
          <option value="60">≥ 60</option>
        </select>
        <span className="text-tertiary" style={{ fontSize: 12.5, marginLeft: 'auto' }}>
          сортировка: по убыванию балла (сервер)
        </span>
      </div>

      {items === null && error === null && <LoadingState text="Ищем возможности…" />}
      {error !== null && <ErrorState message={error} onRetry={load} />}

      {items !== null &&
        (items.length === 0 ? (
          <div className="state-box">
            <div className="state-box-icon">◌</div>
            <div className="state-box-title">Ничего не найдено</div>
            <div className="state-box-hint">Попробуйте изменить фильтры.</div>
          </div>
        ) : (
          <div className="list">
            {items.map((opportunity) => (
              <OpportunityRow key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        ))}
    </div>
  );
}

function OpportunityRow({ opportunity }: { opportunity: OpportunityDto }) {
  const latestPlacement = opportunity.placements[opportunity.placements.length - 1];
  const displayProvider =
    latestPlacement !== undefined
      ? { name: latestPlacement.providerName, type: latestPlacement.providerType }
      : opportunity.provider !== null
        ? { name: opportunity.provider.name, type: opportunity.provider.type }
        : null;

  return (
    <div className="row">
      <div className="row-main">
        <div className="row-title">
          <Link to={`/opportunities/${opportunity.id}`}>{opportunity.platformName}</Link>
          <StatusBadge status={opportunity.status} />
        </div>
        <div className="row-sub">
          <span>{opportunity.categoryName ?? '—'}</span>
          <span>{TYPE_LABELS[opportunity.placementType] ?? opportunity.placementType}</span>
          <span className="chip">
            {METHOD_LABELS[opportunity.placementMethod] ?? opportunity.placementMethod}
          </span>
          {displayProvider !== null && (
            <span>
              {displayProvider.name}
              {displayProvider.type !== null ? ` · ${displayProvider.type}` : ''}
            </span>
          )}
          {opportunity.platformUrl !== null && (
            <a
              className="platform-link"
              href={opportunity.platformUrl}
              target="_blank"
              rel="noreferrer"
            >
              {opportunity.platformUrl}
            </a>
          )}
        </div>
        {opportunity.whyRecommended !== null && (
          <div className="row-reason">{opportunity.whyRecommended}</div>
        )}
        {opportunity.providerCapabilities.length > 0 && (
          <div className="mt-8">
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
        {opportunity.allowedActions.length > 0 && (
          <div className="row-actions">
            {opportunity.allowedActions.map((action) => (
              <Link
                key={action}
                className="btn btn-primary btn-sm"
                to={`/opportunities/${opportunity.id}`}
              >
                {ACTION_LABELS[action] ?? action}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="row-side">
        <ScoreBadge score={opportunity.score} />
        <span className="score-caption">балл</span>
      </div>
    </div>
  );
}
