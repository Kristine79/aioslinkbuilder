/**
 * Negotiation copilot. The human pastes a donor reply; the AI classifies the
 * intent and prepares a suggested response, strategy, recommended price range
 * (when the campaign data allows it), a fallback and risks. AI prepares — the
 * human approves and sends. This is never autonomous negotiation.
 */

export const NEGOTIATION_INTENTS = [
  'ACCEPTED',
  'REJECTED',
  'PRICE_NEGOTIATION',
  'CONTENT_REQUIREMENTS',
  'LINK_ATTRIBUTE_REQUEST',
  'NEEDS_CLARIFICATION',
  'MANUAL_REVIEW',
] as const;

export type NegotiationIntent = (typeof NEGOTIATION_INTENTS)[number];

export interface PriceRange {
  min: number;
  max: number;
  currency: string;
}

export interface NegotiationAnalysis {
  intent: NegotiationIntent;
  donorReply: string;
  suggestedResponse: string;
  strategy: string;
  recommendedPrice: PriceRange | null;
  fallbackOption: string | null;
  risks: string[];
  confidence: number | null;
  analyzedAt: string;
}

export interface NegotiationReply {
  role: 'donor' | 'ai' | 'human';
  text: string;
  at: string;
}

export interface NegotiationSession {
  status: 'OPEN' | 'RESOLVED';
  replies: NegotiationReply[];
  analysis: NegotiationAnalysis | null;
}

export function emptyNegotiationSession(): NegotiationSession {
  return { status: 'OPEN', replies: [], analysis: null };
}
