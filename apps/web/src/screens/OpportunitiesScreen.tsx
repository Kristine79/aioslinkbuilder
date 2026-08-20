/**
 * Возможности — the primary product screen.
 * Ranked list of AI-found placements with score, recommendation, provider,
 * execution method, discovery source and status. The «Найти площадки» action
 * runs the real discovery pipeline (sources → classification → scoring)
 * through the backend and shows the pipeline progress in the UI.
 *
 * The screen distinguishes four honest states when the list is empty:
 * — поиск ещё не запускался;
 * — поиск завершён, но новых площадок не найдено;
 * — поиск завершился ошибкой;
 * — найденные площадки есть, но их скрывают активные фильтры.
 * The last discovery outcome is loaded from the backend (the server is the
 * source of truth) and restored across a refresh or a restart.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { api, ApiError } from '../api/client';
import type { CategoryDto, DiscoverResultDto, OpportunityDto } from '../api/types';
import { Alert, Chip, ChipList, ErrorState, LoadingState, StatusBadge } from '../components/ui';
import { HelpTip } from '../components/HelpTip';
import { ScoreBadge } from '../components/Score';
import { discoveryHasRun, useDiscoveryState } from '../discoveryState';
import {
  ACTION_LABELS,
  CAPABILITY_LABELS,
  DISCOVERY_SOURCE_LABELS,
  METHOD_LABELS,
  pluralRu,
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

interface OpportunitiesQueryState {
  items: OpportunityDto[] | null;
  categories: CategoryDto[];
  error: string | null;
  filtersActive: boolean;
  query: ReturnType<typeof readQuery>;
  load: () => void;
  prepend: (items: OpportunityDto[]) => void;
  clearFilters: () => void;
}

function readQuery(params: URLSearchParams) {
  const category = params.get('category') ?? undefined;
  const method = params.get('method') ?? undefined;
  const status = params.get('status') ?? undefined;
  const source = params.get('source') ?? undefined;
  const placementType = params.get('placementType') ?? undefined;
  const risk = params.get('risk') ?? undefined;
  const sort = params.get('sort') ?? 'score';
  const minScoreRaw = params.get('minScore');
  const minScore = minScoreRaw === null ? undefined : Number(minScoreRaw);
  const donorQualityRaw = params.get('donorQuality');
  const donorQuality = donorQualityRaw === null ? undefined : Number(donorQualityRaw);
  const minTrafficRaw = params.get('minTraffic');
  const minTraffic = minTrafficRaw === null ? undefined : Number(minTrafficRaw);
  return {
    ...(category !== undefined ? { category } : {}),
    ...(method !== undefined ? { method } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(placementType !== undefined ? { placementType } : {}),
    ...(risk !== undefined ? { risk } : {}),
    ...(sort !== 'score' ? { sort } : {}),
    ...(minScore !== undefined ? { minScore } : {}),
    ...(donorQuality !== undefined ? { donorQuality } : {}),
    ...(minTraffic !== undefined ? { minTraffic } : {}),
  };
}

function useOpportunities(): OpportunitiesQueryState {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<OpportunityDto[] | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => readQuery(searchParams), [searchParams]);

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

  const prepend = useCallback((newItems: OpportunityDto[]) => {
    setItems((previous) => {
      const ids = new Set(newItems.map((item) => item.id));
      return [...newItems, ...(previous ?? []).filter((item) => !ids.has(item.id))];
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  return {
    items,
    categories,
    error,
    filtersActive: Object.keys(query).length > 0,
    query,
    load,
    prepend,
    clearFilters,
  };
}

export function OpportunitiesScreen() {
  const { items, categories, error, load, prepend, clearFilters, filtersActive, query } =
    useOpportunities();
  const [, setSearchParams] = useSearchParams();
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [discoveryBanner, setDiscoveryBanner] = useState<DiscoverResultDto | null>(null);
  const { state: discovery, refresh: refreshDiscovery } = useDiscoveryState();

  // Supports the "Найти площадки →" CTA from the company screen: opening
  // /opportunities?discover=1 starts the search automatically.
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('discover') === '1') {
      setShowDiscovery(true);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('discover');
        return next;
      });
    }
  }, []);

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

  const loadDiscoveryState = useCallback(() => {
    // The backend is the source of truth for discovery state. After the list
    // loads we re-sync so the empty state reflects the persisted run outcome
    // (no results vs. never ran vs. failed) even after a refresh/restart.
    refreshDiscovery();
  }, [refreshDiscovery]);

  useEffect(() => {
    loadDiscoveryState();
  }, [loadDiscoveryState]);

  const finishDiscovery = (result: DiscoverResultDto | null) => {
    setShowDiscovery(false);
    if (result !== null) {
      if (result.discovered > 0) {
        prepend(result.items);
        setDiscoveryBanner(result);
      }
    }
    refreshDiscovery();
    load();
  };

  const methodOptions = useMemo(
    () => [...new Set(items?.map((item) => item.placementMethod) ?? [])],
    [items],
  );
  const statusOptions = useMemo(
    () => [...new Set(items?.map((item) => item.status) ?? [])],
    [items],
  );
  const typeOptions = useMemo(
    () => [...new Set(items?.map((item) => item.placementType) ?? [])],
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

      {discoveryBanner !== null && discoveryBanner.discovered > 0 && (
        <div className="mt-16">
          <Alert tone="success">
            Найдено {discoveryBanner.discovered}{' '}
            {pluralRu(
              discoveryBanner.discovered,
              'новая возможность',
              'новые возможности',
              'новых возможностей',
            )}
            , список обновлён.
          </Alert>
        </div>
      )}

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
        <select
          className="select filter-select"
          value={query.placementType ?? 'all'}
          onChange={(event) => updateFilter('placementType', event.target.value)}
          aria-label="Тип размещения"
        >
          <option value="all">Все типы</option>
          {typeOptions.map((option) => (
            <option key={option} value={option}>
              {TYPE_LABELS[option] ?? option}
            </option>
          ))}
        </select>
        <select
          className="select filter-select"
          value={query.risk ?? 'all'}
          onChange={(event) => updateFilter('risk', event.target.value)}
          aria-label="Риск донора"
        >
          <option value="all">Любой риск</option>
          <option value="LOW">Низкий риск</option>
          <option value="MEDIUM">Средний риск</option>
          <option value="HIGH">Высокий риск</option>
          <option value="UNKNOWN">Не оценён</option>
        </select>
        <select
          className="select filter-select"
          value={query.sort ?? 'score'}
          onChange={(event) => updateFilter('sort', event.target.value)}
          aria-label="Сортировка"
        >
          <option value="score">По баллу</option>
          <option value="donorQuality">По качеству донора</option>
          <option value="traffic">По трафику</option>
          <option value="relevance">По релевантности</option>
          <option value="lowestRisk">По наименьшему риску</option>
          <option value="ease">По простоте исполнения</option>
        </select>
        {filtersActive && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={clearFilters}>
            Сбросить фильтры
          </button>
        )}
      </div>

      {items === null && error === null && <LoadingState text="Ищем возможности…" />}
      {error !== null && <ErrorState message={error} onRetry={load} />}

      {items !== null &&
        (items.length === 0 ? (
          <div className="state-box">
            <div className="state-box-icon">
              {filtersActive ? '▦' : discovery.status === 'FAILED' ? '!' : '◌'}
            </div>
            <div className="state-box-title">
              {filtersActive
                ? 'Ничего не соответствует фильтрам'
                : discovery.status === 'FAILED'
                  ? 'Поиск площадок завершился ошибкой'
                  : discovery.status === 'RUNNING'
                    ? 'Поиск площадок выполняется…'
                    : discoveryHasRun(discovery.status)
                      ? 'Новых площадок не найдено'
                      : 'Поиск ещё не запускался'}
            </div>
            <div className="state-box-hint">
              {filtersActive
                ? 'Найденные площадки есть, но их скрывают активные фильтры. Сбросьте фильтры или измените условия поиска.'
                : discovery.status === 'FAILED'
                  ? `Запуск поиска не завершился: ${discovery.failure ?? 'неизвестная ошибка провайдера'}. Повторите попытку.`
                  : discovery.status === 'RUNNING'
                    ? 'Система ищет площадки по направлениям стратегии. Обновите страницу чуть позже.'
                    : discoveryHasRun(discovery.status)
                      ? 'По текущей стратегии система не нашла новых подходящих площадок. Можно повторить поиск позже или изменить стратегию размещений.'
                      : 'Запустите поиск, чтобы найти площадки по направлениям стратегии.'}
            </div>
            <div className="state-actions">
              {filtersActive ? (
                <button className="btn btn-primary mt-16" type="button" onClick={clearFilters}>
                  Сбросить фильтры
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-primary mt-16"
                    type="button"
                    onClick={() => setShowDiscovery(true)}
                  >
                    {discoveryHasRun(discovery.status) ? 'Повторить поиск' : 'Найти площадки'}
                  </button>
                  {discoveryHasRun(discovery.status) && (
                    <Link className="btn btn-secondary mt-16" to="/company">
                      Изменить стратегию
                    </Link>
                  )}
                </>
              )}
            </div>
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
          {isDemoProvider && <span className="chip chip-demo">Демо</span>}
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
        <span className="score-caption">
          балл{' '}
          <HelpTip
            text="Балл 0–100 по факторам: релевантность, донор, качество размещения, автоматизация. Это оценка, а не гарантия — смотрите разбивку в карточке."
            align="right"
          />
        </span>
      </div>
    </div>
  );
}

/**
 * Pipeline modal: shows the discovery stages as they run, then performs the
 * real backend discovery call and reports how many opportunities were found.
 * The modal always completes visibly — with results, an error or a finished
 * "nothing new found" state — and hands the outcome back to the screen so
 * «Показать список» performs a real list transition.
 */
function DiscoveryPipelineModal({
  onClose,
}: {
  onClose: (result: DiscoverResultDto | null) => void;
}) {
  const navigate = useNavigate();
  const [runId, setRunId] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<'pipeline' | 'request' | 'done'>('pipeline');
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
          timerRef.current = window.setTimeout(resolve, 450);
        });
      }
      if (cancelled) return;
      setStepIndex(DISCOVERY_STEPS.length);
      setPhase('request');
      try {
        const discovery = await api.discover();
        if (cancelled) return;
        setResult(discovery);
        setPhase('done');
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError({
          message,
          noAnalysis: err instanceof ApiError && err.code === 'NO_ANALYSIS',
        });
        setPhase('done');
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [runId]);

  const restart = () => {
    setResult(null);
    setError(null);
    setPhase('pipeline');
    setStepIndex(0);
    setRunId((current) => current + 1);
  };

  const goToAnalysis = () => {
    onClose(null);
    void navigate('/company');
  };

  const showList = () => {
    onClose(result);
  };

  const stepsDone = stepIndex >= DISCOVERY_STEPS.length;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Поиск площадок">
        <div className="modal-header">
          <div className="card-title">Поиск площадок</div>
          {phase === 'request' && <span className="chip">ожидание ответа сервера</span>}
        </div>

        {phase === 'pipeline' && (
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

        {phase === 'request' && (
          <div>
            <div className="pipeline-steps">
              {DISCOVERY_STEPS.map((label) => (
                <div key={label} className="pipeline-step done">
                  <span className="pipeline-marker">✓</span>
                  <span className="pipeline-label">{label}</span>
                </div>
              ))}
            </div>
            <div className="pipeline-waiting">
              <span className="spinner" aria-hidden="true" />
              <div>
                <div className="pipeline-waiting-title">Запускаем поиск на сервере…</div>
                <div className="text-tertiary" style={{ fontSize: 12 }}>
                  Система проверяет площадки по направлениям стратегии. Это может занять до минуты.
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'done' && error !== null && (
          <div>
            {error.noAnalysis ? (
              <div className="state-box">
                <div className="state-box-icon">◈</div>
                <div className="state-box-title">Сначала выполните анализ компании</div>
                <div className="state-box-hint">
                  Поиск площадок начинается с определения релевантных категорий: запустите AI-анализ
                  компании на экране «Компания и анализ».
                </div>
                <div className="state-actions">
                  <button className="btn btn-primary mt-16" type="button" onClick={goToAnalysis}>
                    Перейти к анализу
                  </button>
                </div>
              </div>
            ) : (
              <div className="state-box">
                <div className="state-box-icon">⚠</div>
                <div className="state-box-title">Не удалось найти площадки</div>
                <div className="state-box-hint">{error.message}</div>
                <div className="state-actions">
                  <button className="btn btn-secondary mt-16" type="button" onClick={restart}>
                    Повторить
                  </button>
                  <button
                    className="btn btn-ghost mt-16"
                    type="button"
                    onClick={() => onClose(null)}
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'done' && result !== null && (
          <div>
            <div className="state-box">
              <div className="state-box-icon">{result.discovered > 0 ? '✓' : '◌'}</div>
              <div className="state-box-title">
                {result.discovered > 0
                  ? `Найдено ${result.discovered} ${pluralRu(
                      result.discovered,
                      'новая возможность',
                      'новые возможности',
                      'новых возможностей',
                    )}`
                  : 'Новых площадок не найдено'}
              </div>
              <div className="state-box-hint">
                {result.discovered > 0
                  ? `Классифицировано и оценено: ${result.classified}. Источники: ${result.sources
                      .map((source) => DISCOVERY_SOURCE_LABELS[source] ?? source)
                      .join(', ')}.`
                  : 'По текущей стратегии система не нашла новых подходящих площадок. Можно повторить поиск позже или изменить стратегию размещений.'}
              </div>
            </div>
            {stepsDone && (
              <div className="pipeline-steps" style={{ marginTop: 8 }}>
                {DISCOVERY_STEPS.map((label) => (
                  <div key={label} className="pipeline-step done">
                    <span className="pipeline-marker">✓</span>
                    <span className="pipeline-label">{label}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex mt-16">
              <button className="btn btn-primary" type="button" onClick={showList}>
                Показать список
              </button>
              {result.discovered === 0 && (
                <button className="btn btn-secondary" type="button" onClick={restart}>
                  Повторить поиск
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
