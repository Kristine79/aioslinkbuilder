import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PLACEMENT_TYPE,
  DEFAULT_PLACEMENT_TYPE_BY_CATEGORY,
  placementTypeForCategory,
} from '@aios/domain';
import type { PlacementCategory } from '@aios/domain';

function category(code: string): PlacementCategory {
  return { id: `cat-${code}`, code, name: code, description: null, sortOrder: 1 };
}

describe('placementTypeForCategory', () => {
  it('maps known catalog category codes to their default placement types', () => {
    expect(placementTypeForCategory(category('maps-local'))).toBe('BUSINESS_PROFILE');
    expect(placementTypeForCategory(category('furniture-directories'))).toBe('DIRECTORY_LISTING');
    expect(placementTypeForCategory(category('interior-design'))).toBe('EDITORIAL_PUBLICATION');
    expect(placementTypeForCategory(category('architecture'))).toBe('EDITORIAL_PUBLICATION');
    expect(placementTypeForCategory(category('professional-platforms'))).toBe('BUSINESS_PROFILE');
    expect(placementTypeForCategory(category('media-pr'))).toBe('EDITORIAL_PUBLICATION');
    expect(placementTypeForCategory(category('social-platforms'))).toBe('SOCIAL_PROFILE');
    expect(placementTypeForCategory(category('b2b-regional'))).toBe('DIRECTORY_LISTING');
  });

  it('falls back to the default placement type for unknown categories', () => {
    expect(placementTypeForCategory(category('unknown-category'))).toBe(DEFAULT_PLACEMENT_TYPE);
  });

  it('covers every seed category code explicitly', () => {
    const seedCodes = [
      'maps-local',
      'furniture-directories',
      'interior-design',
      'architecture',
      'professional-platforms',
      'media-pr',
      'social-platforms',
      'b2b-regional',
    ];
    for (const code of seedCodes) {
      expect(DEFAULT_PLACEMENT_TYPE_BY_CATEGORY[code]).toBeDefined();
    }
  });
});
