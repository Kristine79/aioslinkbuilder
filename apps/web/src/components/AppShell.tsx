/**
 * App shell: dark sidebar navigation + top bar with the active campaign
 * switcher (multi-company/multi-campaign support) and the «Новая компания»
 * entry point.
 */

import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { api } from '../api/client';
import type { CampaignListItemDto, CompanyListItemDto } from '../api/types';
import { getActiveCampaignId, setActiveCampaignId, subscribeCompaniesChanged } from '../state';

interface NavEntry {
  to: string;
  label: string;
  icon: string;
}

const NAV: readonly NavEntry[] = [
  { to: '/', label: 'Обзор', icon: '▦' },
  { to: '/company', label: 'Компания и анализ', icon: '◈' },
  { to: '/opportunities', label: 'Возможности', icon: '☰' },
  { to: '/compare', label: 'Сравнение доноров', icon: '⇆' },
  { to: '/plans', label: 'План размещений', icon: '◉' },
  { to: '/links', label: 'Ссылки и анкоры', icon: '⌁' },
  { to: '/activity', label: 'Активность и доказательства', icon: '≡' },
  { to: '/companies', label: 'Компании', icon: '◇' },
  { to: '/help', label: 'Справка', icon: '?' },
];

function Icon({ name }: { name: string }) {
  return <span className="nav-icon">{name}</span>;
}

export function AppShell() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyListItemDto[]>([]);
  const [activeCampaignId, setActiveCampaign] = useState<string | null>(() =>
    getActiveCampaignId(),
  );

  const load = useCallback(() => {
    api
      .companies()
      .then((result) => {
        setCompanies(result.items);
        const campaigns = result.items.flatMap((company) => company.campaigns);
        const active = getActiveCampaignId();
        if (
          campaigns.length > 0 &&
          (active === null || !campaigns.some((campaign) => campaign.id === active))
        ) {
          setActiveCampaignId(campaigns[0]?.id ?? null);
          setActiveCampaign(campaigns[0]?.id ?? null);
        }
      })
      .catch(() => {
        // The shell stays usable without the companies endpoint; pages show
        // their own error states.
      });
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = subscribeCompaniesChanged(load);
    return unsubscribe;
  }, [load]);

  const selectCampaign = (campaignId: string) => {
    setActiveCampaignId(campaignId);
    setActiveCampaign(campaignId);
    void navigate('/');
  };

  const activeCampaign = companies
    .flatMap((company) => company.campaigns)
    .find((campaign) => campaign.id === activeCampaignId);
  const activeCompany = companies.find((company) =>
    company.campaigns.some((campaign) => campaign.id === activeCampaignId),
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">AI</div>
          <div>
            <div className="sidebar-brand-name">AI Backlink OS</div>
            <div className="sidebar-brand-sub">
              AI-powered platform for discovering, evaluating and acquiring high-quality backlinks.
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((entry) => (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon name={entry.icon} />
              <span className="nav-label">{entry.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">AI Backlink OS</div>
      </aside>
      <div className="main">
        <div className="topbar">
          <div className="topbar-title">AI Backlink OS</div>
          {companies.length > 0 && (
            <div className="topbar-campaign">
              <label className="topbar-label" htmlFor="campaign-switcher">
                Кампания
              </label>
              <select
                id="campaign-switcher"
                className="select campaign-switch"
                value={activeCampaign?.id ?? ''}
                onChange={(event) => selectCampaign(event.target.value)}
                aria-label="Выбор кампании"
              >
                {companies.map((company) => (
                  <optgroup key={company.id} label={company.name}>
                    {company.campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}
          {activeCompany !== undefined && activeCampaign !== undefined && (
            <span className="text-tertiary topbar-company" style={{ fontSize: 12 }}>
              {activeCompany.name}
            </span>
          )}
          <div className="topbar-spacer" />
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={() => void navigate('/companies?new=1')}
          >
            + Новая компания
          </button>
          <a
            href="https://github.com/Kristine79/aioslinkbuilder"
            className="text-tertiary"
            style={{ fontSize: 12, marginLeft: 12 }}
          >
            github
          </a>
        </div>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export type { CampaignListItemDto };
