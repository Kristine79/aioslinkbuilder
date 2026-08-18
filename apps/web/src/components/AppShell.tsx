/**
 * App shell: dark sidebar navigation + top bar with the active campaign.
 */

import { NavLink, Outlet } from 'react-router-dom';

interface NavEntry {
  to: string;
  label: string;
  icon: string;
}

const NAV: readonly NavEntry[] = [
  { to: '/', label: 'Обзор', icon: '▦' },
  { to: '/company', label: 'Компания и анализ', icon: '◈' },
  { to: '/opportunities', label: 'Возможности', icon: '☰' },
  { to: '/activity', label: 'Активность и доказательства', icon: '≡' },
];

function Icon({ name }: { name: string }) {
  return <span className="nav-icon">{name}</span>;
}

export function AppShell() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">AI</div>
          <div>
            <div className="sidebar-brand-name">AI OS</div>
            <div className="sidebar-brand-sub">Линкбилдинг</div>
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
        <div className="sidebar-footer">
          Демо-режим
          <br />
          Синтетическая компания Nordhaus.
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <div className="topbar-title">AI OS · Линкбилдинг</div>
          <div className="topbar-campaign">
            <span className="chip">Кампания</span>
            <span className="topbar-campaign-name">Nordhaus Demo Campaign</span>
          </div>
          <div className="topbar-spacer" />
          <a
            href="https://github.com/anomalyco/aioslinkbuilder"
            className="text-tertiary"
            style={{ fontSize: 12 }}
          >
            прототип
          </a>
        </div>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
