/**
 * Anchor strategy. The system recommends an anchor type based on the target
 * page, the surrounding context, the campaign objective and — when available
 * — the campaign anchor profile. If no anchor profile exists, no distribution
 * analysis is claimed: `profileAvailable` stays false so the UI can label the
 * recommendation accordingly.
 */

export const ANCHOR_TYPES = [
  'EXACT_MATCH',
  'PARTIAL_MATCH',
  'BRANDED',
  'GENERIC',
  'URL',
  'LONG_TAIL',
] as const;

export type AnchorType = (typeof ANCHOR_TYPES)[number];

export interface AnchorRecommendation {
  anchorType: AnchorType;
  anchor: string;
  alternatives: string[];
  explanation: string;
  confidence: number;
  /** Whether a campaign anchor-distribution profile informed the decision. */
  profileAvailable: boolean;
}

export interface AnchorRecommendationInput {
  placementObjective: string;
  companyName: string;
  targetKeyword: string | null;
  surroundingContext: string | null;
  targetPageRelevance: number | null;
  anchorProfileAvailable: boolean;
}

const ANCHOR_TYPE_LABELS: Readonly<Record<AnchorType, string>> = {
  EXACT_MATCH: 'exact-match',
  PARTIAL_MATCH: 'partial-match',
  BRANDED: 'branded',
  GENERIC: 'generic',
  URL: 'url',
  LONG_TAIL: 'long-tail',
};

/**
 * Deterministic anchor type recommendation (fallback + validation baseline).
 * The AI generates the concrete anchor; this function decides the type and
 * produces the human-readable rationale.
 */
export function recommendAnchorType(input: AnchorRecommendationInput): {
  anchorType: AnchorType;
  explanation: string;
} {
  const context = (input.surroundingContext ?? '').toLowerCase();
  const companyMentioned =
    input.companyName.trim().length > 0 && context.includes(input.companyName.trim().toLowerCase());

  if (companyMentioned && input.targetKeyword !== null) {
    return {
      anchorType: 'PARTIAL_MATCH',
      explanation:
        `Бренд уже упомянут в контексте; рекомендуется partial-match, потому что exact-match в данном контексте выглядит неестественно.`,
    };
  }
  if (input.targetKeyword === null || input.targetKeyword.trim().length === 0) {
    return {
      anchorType: 'BRANDED',
      explanation:
        'Целевой ключевой запрос не задан — безопаснее использовать branded-анкор на основе названия компании.',
    };
  }
  if ((input.targetPageRelevance ?? 0) >= 85) {
    return {
      anchorType: 'PARTIAL_MATCH',
      explanation:
        `Страница высоко релевантна запросу «${input.targetKeyword}»; рекомендуется partial-match, полный exact-match в редакционном контексте выглядел бы неестественно.`,
    };
  }
  return {
    anchorType: 'LONG_TAIL',
    explanation:
      'Релевантность контекста средняя — long-tail формулировка выглядит естественнее и снижает риск переоптимизации.',
  };
}

export function anchorTypeLabel(anchorType: AnchorType): string {
  return ANCHOR_TYPE_LABELS[anchorType];
}
