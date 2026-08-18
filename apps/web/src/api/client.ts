/**
 * Typed API client. Thin fetch wrapper — no business logic here.
 * The backend is the source of truth for state and allowed actions.
 */

import type {
  ActivityDto,
  ApiErrorDto,
  CategoryDto,
  CompanyDto,
  OpportunityDto,
  OverviewDto,
  PlacementDto,
  StrategyItemDto,
} from './types';

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

export interface OpportunitiesQuery {
  category?: string;
  method?: string;
  status?: string;
  minScore?: number;
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
  overview: (): Promise<OverviewDto> => request('/api/overview'),
  company: (): Promise<CompanyDto> => request('/api/company'),
  analyzeCompany: (): Promise<CompanyDto> => request('/api/company/analyze', { method: 'POST' }),
  strategy: (): Promise<{ items: StrategyItemDto[] }> => request('/api/strategy'),
  opportunities: (query: OpportunitiesQuery): Promise<{ items: OpportunityDto[] }> => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '' && value !== 'all') {
        params.set(key, String(value));
      }
    }
    const suffix = params.size === 0 ? '' : `?${params.toString()}`;
    return request(`/api/opportunities${suffix}`);
  },
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
  activity: (): Promise<ActivityDto> => request('/api/activity'),
};

export type { PlacementDto };
