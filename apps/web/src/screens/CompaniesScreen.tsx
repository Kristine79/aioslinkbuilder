/**
 * Компании — список клиентов и их кампаний + вход в создание новой
 * компании (wizard). Каждая кампания открывается в общем продукте:
 * анализ → стратегия → возможности.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { api } from '../api/client';
import type { CompanyListItemDto } from '../api/types';
import { NewCompanyWizard } from '../components/NewCompanyWizard';
import { ErrorState, LoadingState } from '../components/ui';
import { CAMPAIGN_STATUS_LABELS } from '../ru';
import { setActiveCampaignId } from '../state';

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

  const openCampaign = (campaignId: string) => {
    setActiveCampaignId(campaignId);
    window.location.href = '/';
  };

  return (
    <div>
      <div className="flex-between">
        <div>
          <h1 className="page-title">Компании</h1>
          <p className="page-subtitle">
            Клиенты и их кампании размещения — каждая компания проходит полный цикл: анализ →
            стратегия → поиск площадок → размещение
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
            <section className="card" key={company.id}>
              <div className="card-header">
                <div className="card-title" style={{ flex: 1 }}>
                  {company.name}
                </div>
                {company.industry !== null && <span className="chip">{company.industry}</span>}
              </div>
              <div className="card-body">
                {company.description !== null && (
                  <p className="text-secondary" style={{ fontSize: 13, marginTop: 0 }}>
                    {company.description}
                  </p>
                )}
                {company.website !== null && (
                  <div className="kv">
                    <span className="kv-key">Сайт</span>
                    <span className="kv-value">
                      <a href={company.website} target="_blank" rel="noreferrer">
                        {company.website}
                      </a>
                    </span>
                  </div>
                )}
                {company.campaigns.length === 0 ? (
                  <div className="empty-note">Кампаний пока нет.</div>
                ) : (
                  <div className="list" style={{ marginTop: 12 }}>
                    {company.campaigns.map((campaign) => (
                      <div className="row" key={campaign.id}>
                        <div className="row-main">
                          <div className="row-title">
                            {campaign.name}
                            <span className="chip">
                              {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
                            </span>
                          </div>
                          <div className="row-sub">
                            {campaign.goals.length > 0 ? campaign.goals[0] : 'без целей'}
                          </div>
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          type="button"
                          onClick={() => openCampaign(campaign.id)}
                        >
                          Открыть
                        </button>
                      </div>
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
