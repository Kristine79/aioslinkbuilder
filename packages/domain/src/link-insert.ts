/**
 * Link insert draft: everything AI prepares for a LINK_INSERT placement
 * (anchor, alternatives, insertion point, contextual text, rationale and
 * confidence). The generated text must fit the surrounding article — generic
 * "learn more here" style text is explicitly out of scope.
 */

export interface LinkInsertDraft {
  anchor: string;
  /** 2-3 natural anchor alternatives. */
  anchorAlternatives: string[];
  suggestedInsertionPoint: string;
  /** 1-3 sentence link insert that fits the surrounding context. */
  text: string;
  /** Why the insertion is natural in this context. */
  explanation: string;
  /** 0-100 confidence of the AI. */
  confidence: number | null;
  placementObjective: string | null;
}
