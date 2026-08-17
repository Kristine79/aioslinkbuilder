import { ValidationError } from '../errors.js';

export interface CompanyDraft {
  name: string;
  description?: string;
  industry?: string;
  geography?: string[];
  locations?: string[];
  products?: string[];
  targetAudience?: string[];
  website?: string;
}

export function validateCompany(draft: CompanyDraft): void {
  if (draft.name.trim().length === 0) {
    throw new ValidationError('Company name must not be empty');
  }
  for (const key of ['geography', 'locations', 'products', 'targetAudience'] as const) {
    const values = draft[key];
    if (values !== undefined && values.some((value) => value.trim().length === 0)) {
      throw new ValidationError(`Company ${key} entries must not be empty`);
    }
  }
  if (draft.website !== undefined && !isHttpUrl(draft.website)) {
    throw new ValidationError('Company website must be a valid http(s) URL');
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
