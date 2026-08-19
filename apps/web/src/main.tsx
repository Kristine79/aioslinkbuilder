import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { ActivityScreen } from './screens/ActivityScreen';
import { CompaniesScreen } from './screens/CompaniesScreen';
import { CompanyScreen } from './screens/CompanyScreen';
import { CompareScreen } from './screens/CompareScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { HelpScreen } from './screens/HelpScreen';
import { LinksScreen } from './screens/LinksScreen';
import { OpportunityScreen } from './screens/OpportunityScreen';
import { OpportunitiesScreen } from './screens/OpportunitiesScreen';
import { PlansScreen } from './screens/PlansScreen';
import './styles/app.css';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element #root not found');
}

function NotFoundScreen() {
  return (
    <div>
      <h1 className="page-title">Страница не найдена</h1>
      <p className="page-subtitle">По этому адресу ничего нет.</p>
      <Link className="btn btn-secondary" to="/">
        Вернуться к обзору
      </Link>
    </div>
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardScreen />} />
          <Route path="/company" element={<CompanyScreen />} />
          <Route path="/opportunities" element={<OpportunitiesScreen />} />
          <Route path="/opportunities/:id" element={<OpportunityScreen />} />
          <Route path="/compare" element={<CompareScreen />} />
          <Route path="/plans" element={<PlansScreen />} />
          <Route path="/links" element={<LinksScreen />} />
          <Route path="/activity" element={<ActivityScreen />} />
          <Route path="/companies" element={<CompaniesScreen />} />
          <Route path="/help" element={<HelpScreen />} />
          <Route path="*" element={<NotFoundScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
