/**
 * Client-side campaign selection. The active campaign id is persisted in
 * localStorage and appended by the API client to campaign-scoped requests;
 * when no campaign was selected the backend falls back to the default one.
 */

const STORAGE_KEY = 'aios:activeCampaignId';

export function getActiveCampaignId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveCampaignId(id: string | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, id);
    }
  } catch {
    // localStorage unavailable (private mode etc.) — selection is per-tab only.
  }
}

const COMPANIES_CHANGED_EVENT = 'aios:companies-changed';

/** Notifies the shell that the company/campaign list changed (e.g. after creation). */
export function notifyCompaniesChanged(): void {
  window.dispatchEvent(new CustomEvent(COMPANIES_CHANGED_EVENT));
}

export function subscribeCompaniesChanged(handler: () => void): () => void {
  window.addEventListener(COMPANIES_CHANGED_EVENT, handler);
  return () => window.removeEventListener(COMPANIES_CHANGED_EVENT, handler);
}
