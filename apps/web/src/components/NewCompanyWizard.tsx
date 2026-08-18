/**
 * Wizard создания новой компании и кампании.
 * Поля формы собираются на клиенте и отправляются в API (POST /api/companies,
 * POST /api/companies/:id/campaigns); после создания активная кампания
 * переключается на новую. Вся валидация — на бэкенде.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../api/client';
import type { CampaignListItemDto, CompanyDto } from '../api/types';
import { setActiveCampaignId, notifyCompaniesChanged } from '../state';

type Step = 1 | 2 | 3;

const GOAL_PRESETS = [
  'Продвижение бренда на профильных площадках',
  'Локальное продвижение: карты и каталоги',
  'Публикации и упоминания в отраслевых медиа',
  'Профили в соцсетях и сообществах',
] as const;

export function NewCompanyWizard({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [geography, setGeography] = useState('');
  const [locations, setLocations] = useState('');
  const [products, setProducts] = useState('');
  const [audience, setAudience] = useState('');

  const [campaignName, setCampaignName] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [campaignGoalsText, setCampaignGoalsText] = useState('');

  const [createdCompany, setCreatedCompany] = useState<CompanyDto | null>(null);
  const [createdCampaign, setCreatedCampaign] = useState<CampaignListItemDto | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);

  const splitList = (value: string): string[] =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '');

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const company = await api.createCompany({
        name,
        ...(website.trim() !== '' ? { website: website.trim() } : {}),
        ...(industry.trim() !== '' ? { industry: industry.trim() } : {}),
        ...(description.trim() !== '' ? { description: description.trim() } : {}),
        ...(splitList(geography).length > 0 ? { geography: splitList(geography) } : {}),
        ...(splitList(locations).length > 0 ? { locations: splitList(locations) } : {}),
        ...(splitList(products).length > 0 ? { products: splitList(products) } : {}),
        ...(splitList(audience).length > 0 ? { targetAudience: splitList(audience) } : {}),
      });
      const campaign = await api.createCampaign(company.id, {
        name: campaignName,
        goals: splitList(campaignGoalsText),
      });
      setCreatedCompany(company);
      setCreatedCampaign(campaign);
      setActiveCampaignId(campaign.id);
      notifyCompaniesChanged();
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      await api.analyzeCompany();
      setAnalysisDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const openOpportunities = () => {
    onClose();
    void navigate('/opportunities');
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Новая компания">
        <div className="modal-header">
          <div className="card-title">Новая компания</div>
          {!busy && step !== 3 && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>
              Закрыть
            </button>
          )}
        </div>

        {error !== null && <div className="alert alert-error mb-16">{error}</div>}

        {step === 1 && (
          <div>
            <div className="wizard-step-note">Шаг 1 из 2 · Данные компании</div>
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                setStep(2);
              }}
            >
              <div className="field">
                <label className="field-label" htmlFor="company-name">
                  Название компании (обязательно)
                </label>
                <input
                  id="company-name"
                  className="input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="например: Студия мебели «Орион»"
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="company-website">
                  Сайт
                </label>
                <input
                  id="company-website"
                  className="input"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="company-industry">
                  Отрасль
                </label>
                <input
                  id="company-industry"
                  className="input"
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                  placeholder="например: furniture, real-estate, it, services…"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="company-description">
                  Описание
                </label>
                <textarea
                  id="company-description"
                  className="input"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Чем занимается компания, что производит или продаёт"
                  rows={3}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="company-geography">
                  География
                </label>
                <input
                  id="company-geography"
                  className="input"
                  value={geography}
                  onChange={(event) => setGeography(event.target.value)}
                  placeholder="Москва, Россия"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="company-locations">
                  Локации
                </label>
                <input
                  id="company-locations"
                  className="input"
                  value={locations}
                  onChange={(event) => setLocations(event.target.value)}
                  placeholder="Москва, Санкт-Петербург"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="company-products">
                  Продукты и услуги
                </label>
                <input
                  id="company-products"
                  className="input"
                  value={products}
                  onChange={(event) => setProducts(event.target.value)}
                  placeholder="кухни, шкафы, услуги по монтажу — через запятую"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="company-audience">
                  Целевая аудитория
                </label>
                <input
                  id="company-audience"
                  className="input"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  placeholder="дизайнеры, владельцы недвижимости — через запятую"
                />
              </div>
              <div className="flex">
                <button className="btn btn-primary" type="submit">
                  Далее: кампания
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="wizard-step-note">Шаг 2 из 2 · Кампания</div>
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
            >
              <div className="field">
                <label className="field-label" htmlFor="campaign-name">
                  Название кампании (обязательно)
                </label>
                <input
                  id="campaign-name"
                  className="input"
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  placeholder="например: Продвижение «Ориона» в каталогах"
                  required
                />
              </div>
              <div className="field">
                <label className="field-label">Цели кампании</label>
                <div className="chip-list" style={{ marginBottom: 8 }}>
                  {GOAL_PRESETS.map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      className={`chip chip-button ${goals.includes(goal) ? 'chip-active' : ''}`}
                      onClick={() =>
                        setGoals((current) =>
                          current.includes(goal)
                            ? current.filter((entry) => entry !== goal)
                            : [...current, goal],
                        )
                      }
                    >
                      {goal}
                    </button>
                  ))}
                </div>
                <textarea
                  className="input"
                  value={campaignGoalsText}
                  onChange={(event) => setCampaignGoalsText(event.target.value)}
                  placeholder="Или укажите свои цели — по одной на строку"
                  rows={3}
                />
              </div>
              <div className="flex">
                <button className="btn btn-secondary" type="button" onClick={() => setStep(1)}>
                  Назад
                </button>
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Создаём…' : 'Создать компанию и кампанию'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="state-box">
              <div className="state-box-icon">✓</div>
              <div className="state-box-title">Компания и кампания созданы</div>
              <div className="state-box-hint">
                {createdCompany?.name} · {createdCampaign?.name}
              </div>
            </div>
            <div className="flex mt-16" style={{ gap: 8 }}>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void runAnalysis()}
                disabled={busy || analyzing || analysisDone}
              >
                {analyzing
                  ? 'Анализируем…'
                  : analysisDone
                    ? 'AI-анализ выполнен ✓'
                    : 'Запустить AI-анализ'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={openOpportunities}>
                К возможностям
              </button>
            </div>
            <p className="text-tertiary" style={{ fontSize: 12, marginTop: 12 }}>
              {analysisDone
                ? 'Анализ завершён. На экране возможностей нажмите «Найти площадки», чтобы система подобрала площадки по категориям стратегии.'
                : 'После анализа система определит категории площадок и сформирует стратегию размещений. Затем нажмите «Найти площадки» на экране возможностей.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
