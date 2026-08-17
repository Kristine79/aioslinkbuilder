import { describe, expect, it } from 'vitest';

import {
  AIOutputValidationError,
  companyAnalysisSchema,
  opportunityClassificationSchema,
  validateAIOutput,
} from '@aios/ai';

describe('AI output schema validation', () => {
  it('accepts a valid company analysis', () => {
    const output = {
      businessType: 'premium furniture manufacturer',
      topics: ['kitchens', 'interior design'],
      audiences: ['interior designers', 'architects'],
      relevantCategories: ['interior-design', 'architecture'],
      strategicRecommendations: ['publish on design portals'],
    };
    const validated = validateAIOutput(companyAnalysisSchema, output, 'analyzeCompany');
    expect(validated.businessType).toBe('premium furniture manufacturer');
  });

  it('rejects a company analysis with a missing field', () => {
    const output = {
      businessType: 'premium furniture manufacturer',
      topics: ['kitchens'],
    };
    expect(() => validateAIOutput(companyAnalysisSchema, output, 'analyzeCompany')).toThrow(
      AIOutputValidationError,
    );
  });

  it('rejects a company analysis with extra unknown fields', () => {
    const output = {
      businessType: 'premium furniture manufacturer',
      topics: ['kitchens'],
      audiences: [],
      relevantCategories: [],
      strategicRecommendations: [],
      injected: 'should not be stored',
    };
    expect(() => validateAIOutput(companyAnalysisSchema, output, 'analyzeCompany')).toThrow(
      AIOutputValidationError,
    );
  });

  it('rejects a company analysis with empty topics', () => {
    const output = {
      businessType: 'premium furniture manufacturer',
      topics: [''],
      audiences: [],
      relevantCategories: [],
      strategicRecommendations: [],
    };
    expect(() => validateAIOutput(companyAnalysisSchema, output, 'analyzeCompany')).toThrow(
      AIOutputValidationError,
    );
  });

  it('accepts a valid opportunity classification', () => {
    const output = {
      category: 'interior-design',
      placementType: 'DIRECTORY_LISTING',
      topicalRelevance: 90,
      audienceMatch: 75,
      geographicRelevance: 60,
      recommendationReason: 'high traffic from interior design audience',
    };
    const validated = validateAIOutput(
      opportunityClassificationSchema,
      output,
      'classifyOpportunity',
    );
    expect(validated.placementType).toBe('DIRECTORY_LISTING');
  });

  it('rejects an invalid placement type from the AI', () => {
    const output = {
      category: 'interior-design',
      placementType: 'BACKLINK_MEGA_SCHEME',
      topicalRelevance: 90,
      audienceMatch: 75,
      geographicRelevance: 60,
      recommendationReason: 'x',
    };
    expect(() => validateAIOutput(opportunityClassificationSchema, output, 'classifyOpportunity')).toThrow(
      AIOutputValidationError,
    );
  });

  it('rejects classification scores outside 0-100', () => {
    const output = {
      category: 'interior-design',
      placementType: 'DIRECTORY_LISTING',
      topicalRelevance: 120,
      audienceMatch: 75,
      geographicRelevance: 60,
      recommendationReason: 'x',
    };
    expect(() => validateAIOutput(opportunityClassificationSchema, output, 'classifyOpportunity')).toThrow(
      AIOutputValidationError,
    );
  });

  it('rejects non-object AI output', () => {
    expect(() => validateAIOutput(companyAnalysisSchema, 'not-an-object', 'analyzeCompany')).toThrow(
      AIOutputValidationError,
    );
  });

  it('reports validation context and issues', () => {
    try {
      validateAIOutput(companyAnalysisSchema, { topics: [] }, 'analyzeCompany');
    } catch (error) {
      expect(error).toBeInstanceOf(AIOutputValidationError);
      if (error instanceof AIOutputValidationError) {
        expect(error.context).toBe('analyzeCompany');
        expect(error.issues.length).toBeGreaterThan(0);
        expect(error.message).toContain('analyzeCompany');
      }
    }
  });
});
