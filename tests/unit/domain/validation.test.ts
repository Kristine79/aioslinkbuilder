import { describe, expect, it } from 'vitest';

import {
  SCORE_DIMENSIONS,
  ValidationError,
  validateCompany,
  validateScore,
  validateScoreBreakdown,
} from '@aios/domain';
import type { CompanyDraft, ScoreBreakdown } from '@aios/domain';

describe('company validation', () => {
  const validCompany: CompanyDraft = {
    name: 'Nordhaus',
    description: 'Premium made-to-order furniture manufacturer',
    industry: 'furniture',
    geography: ['Moscow', 'Russia'],
    locations: ['Moscow'],
    products: ['kitchens', 'wardrobes'],
    targetAudience: ['interior designers', 'architects'],
    website: 'https://nordhaus.example.com',
  };

  it('accepts a valid company', () => {
    expect(() => validateCompany(validCompany)).not.toThrow();
  });

  it('rejects an empty company name', () => {
    expect(() => validateCompany({ ...validCompany, name: '   ' })).toThrow(ValidationError);
  });

  it('rejects a company without a name', () => {
    expect(() => validateCompany({ ...validCompany, name: '' })).toThrow(ValidationError);
  });

  it('rejects an invalid website URL', () => {
    expect(() => validateCompany({ ...validCompany, website: 'not-a-url' })).toThrow(
      ValidationError,
    );
  });

  it('rejects a non-http website URL', () => {
    expect(() => validateCompany({ ...validCompany, website: 'ftp://example.com' })).toThrow(
      ValidationError,
    );
  });

  it('rejects empty array entries', () => {
    expect(() => validateCompany({ ...validCompany, products: ['kitchens', '  '] })).toThrow(
      ValidationError,
    );
  });

  it('accepts a minimal company with only a name', () => {
    expect(() => validateCompany({ name: 'Nordhaus' })).not.toThrow();
  });
});

describe('score validation', () => {
  const validBreakdown: ScoreBreakdown = {
    topicalRelevance: 90,
    audienceMatch: 80,
    geographicRelevance: 70,
    authority: 60,
    placementQuality: 50,
    automationPotential: 40,
    total: 74,
  };

  it('accepts a valid score breakdown', () => {
    expect(() => validateScoreBreakdown(validBreakdown)).not.toThrow();
  });

  it('accepts scores at the boundaries', () => {
    const boundaries: ScoreBreakdown = {
      topicalRelevance: 0,
      audienceMatch: 100,
      geographicRelevance: 50,
      authority: 0,
      placementQuality: 100,
      automationPotential: 0,
      total: 100,
    };
    expect(() => validateScoreBreakdown(boundaries)).not.toThrow();
  });

  it('rejects a component below the minimum', () => {
    expect(() => validateScoreBreakdown({ ...validBreakdown, topicalRelevance: -1 })).toThrow(
      ValidationError,
    );
  });

  it('rejects a component above the maximum', () => {
    expect(() => validateScoreBreakdown({ ...validBreakdown, audienceMatch: 101 })).toThrow(
      ValidationError,
    );
  });

  it('rejects a NaN component', () => {
    expect(() => validateScoreBreakdown({ ...validBreakdown, authority: Number.NaN })).toThrow(
      ValidationError,
    );
  });

  it('rejects a total score outside the range', () => {
    expect(() => validateScoreBreakdown({ ...validBreakdown, total: 150 })).toThrow(
      ValidationError,
    );
  });

  it('rejects a standalone score outside the range', () => {
    expect(() => validateScore(-5)).toThrow(ValidationError);
    expect(() => validateScore(105)).toThrow(ValidationError);
    expect(() => validateScore(42)).not.toThrow();
  });

  it('covers every documented score dimension', () => {
    expect(SCORE_DIMENSIONS).toEqual([
      'topicalRelevance',
      'audienceMatch',
      'geographicRelevance',
      'authority',
      'placementQuality',
      'automationPotential',
    ]);
  });
});
