/**
 * Компании — список клиентов и их кампаний + вход в создание новой
 * компании (wizard). Каждая кампания открывается в общем продукте:
 * анализ → стратегия → поиск площадок → оценка → размещение → проверка.
 *
 * Карточка компании — единый объект «Компания» (компактные поля без лишних
 * разделителей); кампании внутри визуально отделены как вложенные карточки и
 * показывают реальный этап workflow, компактный прогресс по pipeline и счётчики
 * из /api/companies (бэкенд — источник истины, фронтенд только отображает).
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { api } from '../api/client';
import type { CampaignListItemDto, CompanyListItemDto } from '../api/types';
import { NewCompanyWizard } from '../components/NewCompanyWizard';
import { ErrorState, LoadingState } from '../components/ui';
import { CAMPAIGN_STAGE_LABELS, CAMPAIGN_STAGE_TONES, CAMPAIGN_STEPS, pluralRu } from '../ru';
import { setActiveCampaignId } from '../state';

/** Какой шаг компактного pipeline («Анализ»…«Проверка») занимает кампания по этапу. */
const STAGE_CURRENT_STEP: Record<string, number | null> = {
  DRAFT: 0,
  SEARCH: 2,
  SEARCHING: 2,
  SEARCH_EMPTY: 2,
  SEARCH_FAILED: 2,
  REVIEW: 3,
  PREPARE: 4,
  PLACEMENT: 4,
  VERIFICATION: 5,
  COMPLETED: null,
};

function CampaignCard({ campaign }: { campaign: CampaignListItemDto }) {
  const currentStep = STAGE_CURRENT_STEP[campaign.stage] ?? null;
  const stageLabel = CAMPAIGN_STAGE_LABELS[campaign.stage] ?? campaign.stage;
  const stageTone = CAMPAIGN_STAGE_TONES[campaign.stage] ?? 'tone-gray';
  const { counts } = campaign;

  return (
    <div className="campaign-card">
      <div className="campaign-card-head">
        <div className="campaign-card-name" title={campaign.name}>
          {campaign.name}
        </div>
        <span className={`chip stage-chip ${stageTone}`}>{stageLabel}</span>
      </div>

      <div className="campaign-card-goal">
        {campaign.goals.length > 0 ? campaign.goals[0] : 'без целей'}
      </div>

      <div className="campaign-strip" aria-label="Прогресс кампании">
        {CAMPAIGN_STEPS.map((step, index) => {
          const state =
            currentStep === null
              ? 'done'
              : index < currentStep
                ? 'done'
                : index === currentStep
                  ? 'current'
                  : 'pending';
          const marker = state === 'done' ? '✓' : state === 'current' ? '●' : '○';
          return (
            <span key={step} className={`campaign-step ${state}`}>
              <span className="campaign-step-marker">{marker}</span>
              <span className="campaign-step-label">{step}</span>
            </span>
          );
        })}
      </div>

      <div className="campaign-card-foot">
        <div className="campaign-metrics">
          {counts.opportunities}{' '}
          {pluralRu(counts.opportunities, 'возможность', 'возможности', 'возможностей')}
          {' · '}
          {counts.approved} одобрено
          {' · '}
          {counts.executed} размещено
          {' · '}
          {counts.verified} проверено
        </div>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={() => openCampaign(campaign.id)}
        >
          Открыть →
        </button>
      </div>
    </div>
  );
}

function openCampaign(campaignId: string) {
  setActiveCampaignId(campaignId);
  window.location.href = '/';
}

export function CompaniesScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState<CompanyListItemDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(searchParams.get('new') === '1');

  const load = useCallback(() => {
    setError(null);
    api
      .companies()
      .then((result) => setCompanies(result.items))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openWizard = () => {
    setShowWizard(true);
    setSearchParams({ new: '1' });
  };

  const closeWizard = () => {
    setShowWizard(false);
    setSearchParams({});
    load();
  };

  return (
    <div>
      <div className="flex-between">
        <div>
          <h1 className="page-title">Компании</h1>
          <p className="page-subtitle">
            Клиенты и их кампании размещения — каждая компания проходит полный цикл: анализ →
            стратегия → поиск площадок → оценка → размещение → проверка
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={openWizard}>
          + Новая компания
        </button>
      </div>

      {companies === null && error === null && <LoadingState text="Загружаем компании…" />}
      {error !== null && <ErrorState message={error} onRetry={load} />}

      {companies !== null && companies.length === 0 && (
        <div className="state-box">
          <div className="state-box-icon">◇</div>
          <div className="state-box-title">Пока нет ни одной компании</div>
          <div className="state-box-hint">
            Создайте первую компанию — система проведёт её через анализ, стратегию и поиск площадок.
          </div>
          <button className="btn btn-primary mt-16" type="button" onClick={openWizard}>
            Создать первую компанию
          </button>
        </div>
      )}

      {companies !== null && companies.length > 0 && (
        <div className="grid mt-16">
          {companies.map((company) => (
            <section className="card company-card" key={company.id}>
              <div className="card-header">
                <div className="card-title" style={{ flex: 1 }}>
                  {company.name}
                </div>
                {company.industry !== null && <span className="chip">{company.industry}</span>}
                {company.campaigns.length > 0 && (
                  <span className="text-tertiary" style={{ fontSize: 12 }}>
                    {company.campaigns.length}{' '}
                    {pluralRu(company.campaigns.length, 'кампания', 'кампании', 'кампаний')}
                  </span>
                )}
              </div>
              <div className="card-body">
                {company.description !== null && (
                  <p className="text-secondary company-description">{company.description}</p>
                )}
                {company.website !== null && (
                  <div className="company-website">
                    <span className="text-tertiary company-website-label">Сайт</span>
                    <a href={company.website} target="_blank" rel="noreferrer">
                      {company.website}
                    </a>
                  </div>
                )}
                {company.campaigns.length === 0 ? (
                  <div className="empty-note">Кампаний пока нет.</div>
                ) : (
                  <div className="company-campaigns">
                    <div className="company-section-label">Кампании</div>
                    {company.campaigns.map((campaign) => (
                      <CampaignCard campaign={campaign} key={campaign.id} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {showWizard && <NewCompanyWizard onClose={closeWizard} />}

      <div className="mt-16">
        <Link to="/" className="text-secondary" style={{ fontSize: 13 }}>
          ← К обзору
        </Link>
      </div>
    </div>
  );
}
