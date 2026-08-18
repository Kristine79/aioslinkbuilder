/**
 * Возможности — the primary product screen.
 * Ranked list of AI-found placements with score, recommendation, provider,
 * execution method, discovery source and status. The «Найти площадки» action
 * runs the real discovery pipeline (sources → classification → scoring)
 * through the backend and shows the pipeline progress in the UI.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { api, ApiError } from '../api/client';
import type { CategoryDto, DiscoverResultDto, OpportunityDto } from '../api/types';
import { Chip, ChipList, ErrorState, LoadingState, StatusBadge } from '../components/ui';
import { ScoreBadge } from '../components/Score';
import {
  ACTION_LABELS,
  CAPABILITY_LABELS,
  DISCOVERY_SOURCE_LABELS,
  METHOD_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from '../ru';

const DISCOVERY_STEPS = [
  'Анализ компании',
  'Определение категорий',
  'Поиск площадок',
  'Проверка соответствия',
  'Расчёт оценки',
  'Формирование рекомендаций',
] as const;

function useOpportunities() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<OpportunityDto[] | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const category = searchParams.get('category') ?? undefined;
    const method = searchParams.get('method') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const source = searchParams.get('source') ?? undefined;
    const minScoreRaw = searchParams.get('minScore');
    const minScore = minScoreRaw === null ? undefined : Number(minScoreRaw);
    return {
      ...(category !== undefined ? { category } : {}),
      ...(method !== undefined ? { method } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(source !== undefined ? { source } : {}),
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
  const [showDiscovery, setShowDiscovery] = useState(false);

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
  const sourceOptions = useMemo(
    () => [
      ...new Set(
        (items?.map((item) => item.discoverySource) ?? []).filter(
          (source): source is string => source !== null,
        ),
      ),
    ],
    [items],
  );

  const finishDiscovery = () => {
    setShowDiscovery(false);
    load();
  };

  return (
    <div>
      <div className="flex-between">
        <div>
          <h1 className="page-title">Возможности размещения</h1>
          <p className="page-subtitle">
            Система находит площадки, оценивает их и предлагает способ размещения
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setShowDiscovery(true)}>
          Найти площадки
        </button>
      </div>

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
          className="select filter-select"
          value={query.source ?? 'all'}
          onChange={(event) => updateFilter('source', event.target.value)}
          aria-label="Источник"
        >
          <option value="all">Все источники</option>
          {sourceOptions.map((option) => (
            <option key={option} value={option}>
              {DISCOVERY_SOURCE_LABELS[option] ?? option}
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
            <div className="state-box-hint">
              Запустите «Найти площадки», чтобы система подобрала площадки под компанию, или
              измените фильтры.
            </div>
            <button
              className="btn btn-primary mt-16"
              type="button"
              onClick={() => setShowDiscovery(true)}
            >
              Найти площадки
            </button>
          </div>
        ) : (
          <div className="list">
            {items.map((opportunity) => (
              <OpportunityRow key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        ))}

      {showDiscovery && <DiscoveryPipelineModal onClose={finishDiscovery} />}
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
  const isDemoProvider = displayProvider?.type === 'MOCK';

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
          {opportunity.discoverySource !== null && (
            <span className={`chip chip-source ${opportunity.discoverySource}`}>
              {DISCOVERY_SOURCE_LABELS[opportunity.discoverySource] ?? opportunity.discoverySource}
            </span>
          )}
          {displayProvider !== null && (
            <span>
              {displayProvider.name}
              {isDemoProvider ? ' · демо' : ''}
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

/**
 * Pipeline modal: shows the discovery stages as they run, then performs the
 * real backend discovery call and reports how many opportunities were found.
 */
function DiscoveryPipelineModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [running, setRunning] = useState(true);
  const [result, setResult] = useState<DiscoverResultDto | null>(null);
  const [error, setError] = useState<{ message: string; noAnalysis: boolean } | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      for (let index = 0; index < DISCOVERY_STEPS.length; index += 1) {
        if (cancelled) return;
        setStepIndex(index);
        await new Promise((resolve) => {
          timerRef.current = window.setTimeout(resolve, 600);
        });
      }
      if (cancelled) return;
      setRunning(false);
      try {
        const discovery = await api.discover();
        if (cancelled) return;
        setResult(discovery);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError({
          message,
          noAnalysis: err instanceof ApiError && err.code === 'NO_ANALYSIS',
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const goToAnalysis = () => {
    onClose();
    void navigate('/company');
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Поиск площадок">
        <div className="modal-header">
          <div className="card-title">Поиск площадок</div>
        </div>

        {running && (
          <div>
            <div className="pipeline-steps">
              {DISCOVERY_STEPS.map((label, index) => {
                const state =
                  index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'pending';
                return (
                  <div key={label} className={`pipeline-step ${state}`}>
                    <span className="pipeline-marker">
                      {state === 'done' ? '✓' : state === 'current' ? '…' : ''}
                    </span>
                    <span className="pipeline-label">{label}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-tertiary" style={{ fontSize: 12, marginTop: 12 }}>
              {DISCOVERY_STEPS[stepIndex] ?? ''}…
            </div>
          </div>
        )}

        {!running && error !== null && (
          <div>
            {error.noAnalysis ? (
              <div className="state-box">
                <div className="state-box-icon">◈</div>
                <div className="state-box-title">Сначала выполните анализ компании</div>
                <div className="state-box-hint">
                  Поиск площадок начинается с определения релевантных категорий: запустите AI-анализ
                  компании на экране «Компания и анализ».
                </div>
                <button className="btn btn-primary mt-16" type="button" onClick={goToAnalysis}>
                  Перейти к анализу
                </button>
              </div>
            ) : (
              <div className="state-box">
                <div className="state-box-icon">⚠</div>
                <div className="state-box-title">Не удалось найти площадки</div>
                <div className="state-box-hint">{error.message}</div>
                <button className="btn btn-secondary mt-16" type="button" onClick={onClose}>
                  Закрыть
                </button>
              </div>
            )}
          </div>
        )}

        {!running && result !== null && (
          <div>
            <div className="state-box">
              <div className="state-box-icon">✓</div>
              <div className="state-box-title">
                Найдено {result.discovered}{' '}
                {plural(result.discovered, 'возможность', 'возможности', 'возможностей')}
              </div>
              <div className="state-box-hint">
                {result.discovered > 0
                  ? `Классифицировано и оценено: ${result.classified}. Источники: ${result.sources
                      .map((source) => DISCOVERY_SOURCE_LABELS[source] ?? source)
                      .join(', ')}.`
                  : 'Новых площадок не найдено — каталог уже полностью изучен для этой кампании.'}
              </div>
            </div>
            <div className="flex mt-16">
              <button className="btn btn-primary" type="button" onClick={onClose}>
                Показать список
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
