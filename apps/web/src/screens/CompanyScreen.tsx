/**
 * Компания и AI-анализ: company profile, the schema-validated AI analysis
 * (with a real re-run action) and the derived placement strategy, presented
 * as a workflow: AI analysis → strategy → opportunities.
 *
 * The three levels are kept strictly separate:
 * — AI-анализ:  что система поняла о компании;
 * — Стратегия:  что система рекомендует делать;
 * — Возможности: какие конкретные площадки найдены.
 * Every number/label comes from the backend; no synthetic data is invented.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api, ApiError } from '../api/client';
import type { CategoryDto, CompanyDto, StrategyItemDto } from '../api/types';
import { Alert, Card, Chip, ChipList, ErrorState, LoadingState } from '../components/ui';
import { AI_PROVIDER_LABELS, formatDateTime, pluralRu, TYPE_LABELS } from '../ru';

export function CompanyScreen() {
  const [company, setCompany] = useState<CompanyDto | null>(null);
  const [strategy, setStrategy] = useState<{ items: StrategyItemDto[] } | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .company()
      .then((companyData) => {
        setCompany(companyData);
        return Promise.all([api.strategy(), api.meta()]);
      })
      .then(([strategyData, meta]) => {
        setStrategy(strategyData);
        setCategories(meta.categories);
      })
      .catch((err: unknown) => {
        // The strategy is unavailable until the company analysis exists —
        // that is a normal empty state, not an error.
        if (err instanceof ApiError && err.code === 'NO_ANALYSIS') {
          setStrategy({ items: [] });
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeMessage(null);
    setError(null);
    try {
      const updated = await api.analyzeCompany();
      setCompany(updated);
      setStrategy(null);
      const analysis = await api.strategy();
      setStrategy(analysis);
      const providerName =
        AI_PROVIDER_LABELS[updated.analysis?.provider ?? ''] ?? updated.analysis?.provider;
      setAnalyzeMessage(
        `AI-анализ выполнен${providerName !== undefined && providerName !== null && providerName !== '' ? ` · ${providerName}` : ''} · ${formatDateTime(updated.analysis?.createdAt ?? null)}`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }, []);

  if (company === null && error === null) {
    return <LoadingState text="Загружаем данные компании…" />;
  }
  if (company === null) {
    return <ErrorState message={error ?? 'Неизвестная ошибка'} onRetry={load} />;
  }

  const analysis = company.analysis;
  const providerName = AI_PROVIDER_LABELS[analysis?.provider ?? ''] ?? analysis?.provider;
  const totalOpportunities =
    strategy?.items.reduce((sum, item) => sum + item.opportunityCount, 0) ?? 0;
  const categoryNameByCode = new Map(categories.map((category) => [category.code, category.name]));
  const strategyCodes = new Set((strategy?.items ?? []).map((item) => item.categoryCode));
  // Honest category → strategy mapping: the AI may name categories that have
  // no active direction in the platform catalog yet.
  const unmappedCategories = (analysis?.relevantCategories ?? []).filter(
    (code) => !strategyCodes.has(code),
  );

  return (
    <div>
      <h1 className="page-title">Компания и AI-анализ</h1>
      <p className="page-subtitle">Профиль, выводы модели и стратегия размещений</p>

      {error !== null && (
        <div className="mt-16">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {analyzeMessage !== null && (
        <div className="mt-16">
          <Alert tone="success">{analyzeMessage}</Alert>
        </div>
      )}

      <div className="workflow-chain mt-16">
        <ChainStep
          number="01"
          title="AI-анализ"
          caption="Что система поняла о компании"
          state={analysis === null ? 'pending' : 'done'}
          stateText={
            analysis === null ? 'Не выполнен' : `Выполнен · ${formatDateTime(analysis.createdAt)}`
          }
          to="/company"
        />
        <ChainArrow />
        <ChainStep
          number="02"
          title="Стратегия"
          caption="Что система рекомендует делать"
          state={strategy === null || strategy.items.length === 0 ? 'pending' : 'done'}
          stateText={
            strategy === null || strategy.items.length === 0
              ? 'Ожидает анализа'
              : `${strategy.items.length} ${pluralRu(strategy.items.length, 'направление', 'направления', 'направлений')}`
          }
          to="/company"
        />
        <ChainArrow />
        <ChainStep
          number="03"
          title="Возможности"
          caption="Какие площадки найдены"
          state={totalOpportunities > 0 ? 'done' : 'pending'}
          stateText={totalOpportunities > 0 ? `Найдено: ${totalOpportunities}` : 'Поиск не запущен'}
          to="/opportunities"
        >
          {totalOpportunities === 0 && (
            <Link className="btn btn-primary btn-sm chain-cta" to="/opportunities?discover=1">
              Найти площадки →
            </Link>
          )}
        </ChainStep>
      </div>

      <div className="grid grid-2 mt-16 ">
        <Card title="Профиль компании">
          <div className="company-profile">
            <div className="company-profile-name">{company.name}</div>
            {company.analysis !== null && company.analysis.businessType !== '' && (
              <div className="company-profile-pos">{company.analysis.businessType}</div>
            )}
            {company.analysis === null && company.description !== null && (
              <div className="company-profile-pos">{company.description}</div>
            )}
            <div className="company-profile-grid">
              <ProfilRow label="Отрасль" value={company.industry ?? '—'} />
              <ProfilRow label="Сайт" value={company.website ?? '—'} link={company.website} />
              <ProfilRow label="География" value={company.geography.join(', ') || '—'} />
              <ProfilRow label="Локации" value={company.locations.join(', ') || '—'} />
            </div>
            {company.products.length > 0 && (
              <div className="company-profile-block">
                <div className="company-profile-block-label">Продукты и услуги</div>
                <ChipList>
                  {company.products.map((product) => (
                    <Chip key={product}>{product}</Chip>
                  ))}
                </ChipList>
              </div>
            )}
            {company.targetAudience.length > 0 && (
              <div className="company-profile-block">
                <div className="company-profile-block-label">Целевая аудитория</div>
                <ChipList>
                  {company.targetAudience.map((audience) => (
                    <Chip key={audience}>{audience}</Chip>
                  ))}
                </ChipList>
              </div>
            )}
          </div>
        </Card>

        <Card
          title="AI-анализ"
          actions={
            analysis !== null ? (
              <div className="provenance">
                <span className="provenance-primary">{providerName ?? 'AI'}</span>
                <span className="provenance-secondary">структура проверена</span>
              </div>
            ) : undefined
          }
        >
          {analysis === null ? (
            <div className="state-box state-box-compact">
              <div className="state-box-icon">◈</div>
              <div className="state-box-title">Анализ ещё не выполнен</div>
              <div className="state-box-hint">
                Модель определит тематику, аудитории и релевантные категории площадок.
              </div>
              <div className="state-actions">
                <button
                  className="btn btn-primary mt-16"
                  type="button"
                  onClick={() => void runAnalysis()}
                  disabled={analyzing}
                >
                  {analyzing ? 'Анализируем…' : 'Запустить AI-анализ'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="analysis-head">
                <div className="text-tertiary" style={{ fontSize: 12.5 }}>
                  Последний анализ: {formatDateTime(analysis.createdAt)}
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={() => void runAnalysis()}
                  disabled={analyzing}
                >
                  {analyzing ? 'Анализируем…' : 'Перезапустить анализ'}
                </button>
              </div>

              <div className="analysis-section">
                <div className="section-label">Тип бизнеса</div>
                <div className="analysis-value">{analysis.businessType || '—'}</div>
              </div>
              <div className="analysis-section">
                <div className="section-label">Темы</div>
                <ChipList>
                  {analysis.topics.map((topic) => (
                    <Chip key={topic}>{topic}</Chip>
                  ))}
                </ChipList>
              </div>
              <div className="analysis-section">
                <div className="section-label">Аудитории</div>
                <ChipList>
                  {analysis.audiences.map((audience) => (
                    <Chip key={audience}>{audience}</Chip>
                  ))}
                </ChipList>
              </div>
              <div className="analysis-section">
                <div className="section-label">Релевантные категории</div>
                {analysis.relevantCategories.length > 0 ? (
                  <ChipList>
                    {analysis.relevantCategories.map((code) => (
                      <Chip key={code}>
                        {categoryNameByCode.get(code) ?? code}
                        {!strategyCodes.has(code) && ' · вне каталога'}
                      </Chip>
                    ))}
                  </ChipList>
                ) : (
                  <div className="text-tertiary" style={{ fontSize: 12.5 }}>
                    Категории не определены.
                  </div>
                )}
              </div>
              {analysis.strategicRecommendations.length > 0 && (
                <div className="analysis-section">
                  <div className="section-label">Стратегические рекомендации</div>
                  <ul className="analysis-recs">
                    {analysis.strategicRecommendations.map((recommendation) => (
                      <li key={recommendation}>{recommendation}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-16">
        <Card
          title="Стратегия размещений"
          actions={<span className="section-caption">Что система рекомендует делать</span>}
        >
          {strategy === null ? (
            <div className="state-box state-box-compact">
              <div className="state-box-icon">◌</div>
              <div className="state-box-title">Стратегия не рассчитана</div>
              <div className="state-box-hint">
                Сначала выполните AI-анализ — направления размещений строятся на его результатах.
              </div>
              <div className="state-actions">
                {analysis === null ? (
                  <button
                    className="btn btn-primary mt-16"
                    type="button"
                    onClick={() => void runAnalysis()}
                    disabled={analyzing}
                  >
                    {analyzing ? 'Анализируем…' : 'Запустить AI-анализ'}
                  </button>
                ) : (
                  <Link className="btn btn-primary mt-16" to="/opportunities?discover=1">
                    Найти площадки →
                  </Link>
                )}
              </div>
            </div>
          ) : strategy.items.length === 0 ? (
            <div className="state-box state-box-compact">
              <div className="state-box-icon">◌</div>
              <div className="state-box-title">Пока нет направлений размещений</div>
              <div className="state-box-hint">
                {analysis === null
                  ? 'Запустите AI-анализ компании — он определит релевантные категории.'
                  : 'AI-анализ выполнен, но ни одна из его категорий пока не активирована в каталоге системы.'}
              </div>
              {analysis === null && (
                <div className="state-actions">
                  <button
                    className="btn btn-primary mt-16"
                    type="button"
                    onClick={() => void runAnalysis()}
                    disabled={analyzing}
                  >
                    {analyzing ? 'Анализируем…' : 'Запустить AI-анализ'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="strategy-grid">
                {strategy.items.map((item) => (
                  <div className="strategy-card" key={item.categoryCode}>
                    <div className="strategy-card-name">{item.categoryName}</div>
                    {item.categoryId === null && (
                      <div className="strategy-card-outside">вне каталога</div>
                    )}
                    <div className="strategy-card-type">
                      {TYPE_LABELS[item.placementType] ?? item.placementType}
                    </div>
                    <div className="strategy-card-state">
                      {item.opportunityCount > 0 ? (
                        <span className="badge tone-green">
                          {item.opportunityCount}{' '}
                          {pluralRu(
                            item.opportunityCount,
                            'возможность',
                            'возможности',
                            'возможностей',
                          )}
                        </span>
                      ) : (
                        <span className="badge tone-gray">возможности не найдены</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {analysis !== null && (
                <div className="why-block">
                  <div className="why-block-title">Почему эти направления</div>
                  {analysis.strategicRecommendations.length > 0 ? (
                    <ul className="why-block-list">
                      {analysis.strategicRecommendations.map((recommendation) => (
                        <li key={recommendation}>{recommendation}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-secondary" style={{ fontSize: 13 }}>
                      Направления построены на данных AI-анализа: продуктах, аудитории и тематике
                      компании.
                    </div>
                  )}
                  {unmappedCategories.length > 0 && (
                    <div className="why-block-note">
                      AI определил {analysis.relevantCategories.length}{' '}
                      {pluralRu(
                        analysis.relevantCategories.length,
                        'категорию',
                        'категории',
                        'категорий',
                      )}
                      , из них активировано направлений: {strategy.items.length}. Категории{' '}
                      {unmappedCategories
                        .map((code) => categoryNameByCode.get(code) ?? code)
                        .join(', ')}{' '}
                      появятся в стратегии, когда для них будут найдены площадки.
                    </div>
                  )}
                </div>
              )}

              <div className="strategy-actions mt-16">
                <Link className="btn btn-primary" to="/opportunities?discover=1">
                  Найти площадки →
                </Link>
                <Link className="btn btn-secondary" to="/opportunities">
                  К возможностям
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ChainStep({
  number,
  title,
  caption,
  state,
  stateText,
  to,
  children,
}: {
  number: string;
  title: string;
  caption: string;
  state: 'done' | 'pending';
  stateText: string;
  to: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`chain-step ${state === 'done' ? 'chain-done' : 'chain-pending'}`}>
      <div className="chain-step-num">{number}</div>
      <div className="chain-step-title">{title}</div>
      <div className="chain-step-caption">{caption}</div>
      <div className="chain-step-state">
        {state === 'done' && <span className="chain-step-check">✓</span>}
        <span>{stateText}</span>
      </div>
      {children}
      <Link className="chain-step-link" to={to}>
        Открыть →
      </Link>
    </div>
  );
}

function ChainArrow() {
  return <div className="chain-arrow">→</div>;
}

function ProfilRow({ label, value, link }: { label: string; value: string; link?: string | null }) {
  return (
    <div className="profil-row">
      <span className="profil-key">{label}</span>
      <span className="profil-value">
        {link !== undefined && link !== null ? (
          <a href={link} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          value
        )}
      </span>
    </div>
  );
}
