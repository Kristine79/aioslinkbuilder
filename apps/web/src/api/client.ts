/**
 * Typed API client. Thin fetch wrapper — no business logic here.
 * The backend is the source of truth for state and allowed actions.
 * Campaign-scoped endpoints receive the active campaign id (?campaignId=)
 * so the product supports multiple companies/campaigns; when no campaign is
 * selected the backend falls back to the default one.
 */

import type {
  ActivityDto,
  ApiErrorDto,
  CampaignListItemDto,
  CategoryDto,
  CompanyDto,
  CompanyListItemDto,
  DiscoverResultDto,
  OpportunityDto,
  OverviewDto,
  PlacementDto,
  StrategyItemDto,
} from './types';
import { getActiveCampaignId } from '../state';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const requestInit =
    init?.body === undefined ? init : { ...init, headers: { 'Content-Type': 'application/json' } };
  const response = await fetch(path, requestInit);
  const payload = (await response.json().catch(() => null)) as T | ApiErrorDto | null;
  if (!response.ok) {
    const error = payload as ApiErrorDto | null;
    throw new ApiError(
      response.status,
      error?.error.code ?? 'INTERNAL',
      error?.error.message ?? `HTTP ${response.status}`,
    );
  }
  return payload as T;
}

/** Appends the active campaign id and the given query params to a path. */
function campaignPath(path: string, query?: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    if (value !== '' && value !== 'all') {
      params.set(key, String(value));
    }
  }
  const activeCampaignId = getActiveCampaignId();
  if (activeCampaignId !== null) {
    params.set('campaignId', activeCampaignId);
  }
  const suffix = params.toString();
  return suffix === '' ? path : `${path}?${suffix}`;
}

export interface OpportunitiesQuery {
  category?: string;
  method?: string;
  status?: string;
  source?: string;
  minScore?: number;
}

export interface CompanyDraft {
  name: string;
  website?: string;
  industry?: string;
  description?: string;
  geography?: string[];
  locations?: string[];
  products?: string[];
  targetAudience?: string[];
}

export interface CampaignDraft {
  name: string;
  goals: string[];
}

export interface ActionResult {
  placementId: string;
  status: string;
}

export interface VerifyResult extends ActionResult {
  verification: {
    id: string;
    status: string;
    checkedAt: string | null;
    result: Record<string, unknown> | null;
    failureReason: string | null;
    createdAt: string;
  };
}

export const api = {
  meta: (): Promise<{ categories: CategoryDto[] }> => request('/api/meta'),
  overview: (): Promise<OverviewDto> => request(campaignPath('/api/overview')),
  company: (): Promise<CompanyDto> => request(campaignPath('/api/company')),
  analyzeCompany: (): Promise<CompanyDto> =>
    request(campaignPath('/api/company/analyze'), { method: 'POST' }),
  strategy: (): Promise<{ items: StrategyItemDto[] }> => request(campaignPath('/api/strategy')),
  opportunities: (query: OpportunitiesQuery): Promise<{ items: OpportunityDto[] }> =>
    request(campaignPath('/api/opportunities', query)),
  opportunity: (id: string): Promise<OpportunityDto> => request(`/api/opportunities/${id}`),
  approve: (id: string): Promise<OpportunityDto> =>
    request(`/api/opportunities/${id}/approve`, { method: 'POST' }),
  execute: (id: string): Promise<ActionResult> =>
    request(`/api/opportunities/${id}/execute`, { method: 'POST' }),
  requestManual: (id: string, reason: string): Promise<ActionResult> =>
    request(`/api/opportunities/${id}/request-manual`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  monitor: (id: string): Promise<ActionResult> =>
    request(`/api/placements/${id}/monitor`, { method: 'POST' }),
  verify: (id: string): Promise<VerifyResult> =>
    request(`/api/placements/${id}/verify`, { method: 'POST', body: JSON.stringify({}) }),
  completeManual: (
    id: string,
    body: { externalId: string; liveUrl: string; notes?: string },
  ): Promise<ActionResult> =>
    request(`/api/placements/${id}/complete-manual`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  activity: (): Promise<ActivityDto> => request(campaignPath('/api/activity')),
  discover: (): Promise<DiscoverResultDto> =>
    request(campaignPath('/api/discover'), { method: 'POST' }),
  companies: (): Promise<{ items: CompanyListItemDto[] }> => request('/api/companies'),
  createCompany: (draft: CompanyDraft): Promise<CompanyDto> =>
    request('/api/companies', { method: 'POST', body: JSON.stringify(draft) }),
  createCampaign: (companyId: string, draft: CampaignDraft): Promise<CampaignListItemDto> =>
    request(`/api/companies/${companyId}/campaigns`, {
      method: 'POST',
      body: JSON.stringify(draft),
    }),
};

export type { PlacementDto };
