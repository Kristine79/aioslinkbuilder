import type { PlacementCategory } from './entities/placement-category.js';
import type { PlacementType } from './enums/placement-type.js';

/**
 * Default placement result type per placement category code.
 *
 * This table is strategy seed data: it maps the canonical catalog category
 * codes to the placement type the strategy recommends for them. Individual
 * opportunities are later refined by AI classification; this table only
 * covers categories the analysis did not override.
 */
export const DEFAULT_PLACEMENT_TYPE_BY_CATEGORY: Readonly<Record<string, PlacementType>> = {
  'maps-local': 'BUSINESS_PROFILE',
  'furniture-directories': 'DIRECTORY_LISTING',
  'interior-design': 'EDITORIAL_PUBLICATION',
  architecture: 'EDITORIAL_PUBLICATION',
  'professional-platforms': 'BUSINESS_PROFILE',
  'media-pr': 'EDITORIAL_PUBLICATION',
  'social-platforms': 'SOCIAL_PROFILE',
  'b2b-regional': 'DIRECTORY_LISTING',
};

/** Fallback placement type for categories without an explicit default. */
export const DEFAULT_PLACEMENT_TYPE: PlacementType = 'DIRECTORY_LISTING';

export function placementTypeForCategory(category: PlacementCategory): PlacementType {
  return DEFAULT_PLACEMENT_TYPE_BY_CATEGORY[category.code] ?? DEFAULT_PLACEMENT_TYPE;
}

export interface PlacementStrategyItem {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  placementType: PlacementType;
}

/**
 * Deterministic placement strategy derived from a validated company
 * analysis. The AI contributes the relevant categories and strategic
 * recommendations; category-to-placement-type mapping is deterministic.
 */
export interface PlacementStrategy {
  campaignId: string;
  generatedAt: Date;
  items: PlacementStrategyItem[];
  recommendations: string[];
}
