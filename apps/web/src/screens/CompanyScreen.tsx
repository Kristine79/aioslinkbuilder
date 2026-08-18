/**
 * Компания и AI-анализ: company profile, the schema-validated AI analysis
 * (with a real re-run action) and the derived placement strategy.
 */

import { useCallback, useEffect, useState } from 'react';

import { api } from '../api/client';
import type { CompanyDto, StrategyItemDto } from '../api/types';
import { Alert, Card, Chip, ChipList, ErrorState, LoadingState } from '../components/ui';
import { formatDateTime, TYPE_LABELS } from '../ru';

export function CompanyScreen() {
  const [company, setCompany] = useState<CompanyDto | null>(null);
  const [strategy, setStrategy] = useState<{ items: StrategyItemDto[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([api.company(), api.strategy()])
      .then(([companyData, strategyData]) => {
        setCompany(companyData);
        setStrategy(strategyData);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
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
      setAnalyzeMessage(
        `Анализ выполнен: провайдер ${updated.analysis?.provider ?? '—'}, ${formatDateTime(updated.analysis?.createdAt ?? null)}`,
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

      <div className="grid grid-2 mt-16">
        <Card title="Профиль компании">
          <div className="kv">
            <span className="kv-key">Название</span>
            <span className="kv-value">{company.name}</span>
          </div>
          <div className="kv">
            <span className="kv-key">Отрасль</span>
            <span className="kv-value">{company.industry ?? '—'}</span>
          </div>
          {company.description !== null && (
            <div className="kv">
              <span className="kv-key">Описание</span>
              <span className="kv-value">{company.description}</span>
            </div>
          )}
          <div className="kv">
            <span className="kv-key">Сайт</span>
            <span className="kv-value">
              {company.website !== null ? (
                <a href={company.website} target="_blank" rel="noreferrer">
                  {company.website}
                </a>
              ) : (
                '—'
              )}
            </span>
          </div>
          <div className="kv">
            <span className="kv-key">География</span>
            <span className="kv-value">{company.geography.join(', ') || '—'}</span>
          </div>
          <div className="kv">
            <span className="kv-key">Локации</span>
            <span className="kv-value">{company.locations.join(', ') || '—'}</span>
          </div>
        </Card>

        <Card title="AI-анализ" actions={<span className="chip">схема-валидация пройдена</span>}>
          {company.analysis === null ? (
            <div className="empty-note">Анализ ещё не выполнялся.</div>
          ) : (
            <div>
              <div className="kv">
                <span className="kv-key">Тип бизнеса</span>
                <span className="kv-value">{company.analysis.businessType || '—'}</span>
              </div>
              <div className="kv">
                <span className="kv-key">Модель</span>
                <span className="kv-value mono">{company.analysis.provider}</span>
              </div>
              <div className="kv">
                <span className="kv-key">Выполнен</span>
                <span className="kv-value">{formatDateTime(company.analysis.createdAt)}</span>
              </div>
              <div className="mt-16">
                <div className="text-secondary" style={{ fontSize: 12.5, marginBottom: 6 }}>
                  Темы
                </div>
                <ChipList>
                  {company.analysis.topics.map((topic) => (
                    <Chip key={topic}>{topic}</Chip>
                  ))}
                </ChipList>
              </div>
              <div className="mt-16">
                <div className="text-secondary" style={{ fontSize: 12.5, marginBottom: 6 }}>
                  Аудитории
                </div>
                <ChipList>
                  {company.analysis.audiences.map((audience) => (
                    <Chip key={audience}>{audience}</Chip>
                  ))}
                </ChipList>
              </div>
              <div className="mt-16">
                <div className="text-secondary" style={{ fontSize: 12.5, marginBottom: 6 }}>
                  Релевантные категории
                </div>
                <ChipList>
                  {company.analysis.relevantCategories.map((category) => (
                    <Chip key={category}>{category}</Chip>
                  ))}
                </ChipList>
              </div>
              <div className="mt-16">
                <div className="text-secondary" style={{ fontSize: 12.5, marginBottom: 6 }}>
                  Стратегические рекомендации
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {company.analysis.strategicRecommendations.map((recommendation) => (
                    <li key={recommendation} style={{ marginBottom: 4 }}>
                      {recommendation}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div className="mt-16">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void runAnalysis()}
              disabled={analyzing}
            >
              {analyzing ? 'Анализируем…' : 'Запустить анализ'}
            </button>
            <span className="text-tertiary" style={{ fontSize: 12, marginLeft: 10 }}>
              повторный запуск через API — использует тот же AI-провайдер
            </span>
          </div>
        </Card>
      </div>

      <div className="mt-16">
        <Card title="Стратегия размещений">
          {strategy === null ? (
            <div className="empty-note">Стратегия не рассчитана.</div>
          ) : strategy.items.length === 0 ? (
            <div className="empty-note">
              Для компании нет подходящих категорий размещений. Запустите анализ компании.
            </div>
          ) : (
            <div className="list">
              {strategy.items.map((item) => (
                <div className="row" key={item.categoryCode}>
                  <div className="row-main">
                    <div className="row-title">{item.categoryName}</div>
                    <div className="row-sub mono">{item.categoryCode}</div>
                  </div>
                  <Chip>{TYPE_LABELS[item.placementType] ?? item.placementType}</Chip>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
