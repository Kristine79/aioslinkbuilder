import { ValidationError } from './errors.js';

/**
 * Outreach workflow. Messages are never sent automatically: the human reviews
 * the draft (READY_FOR_REVIEW), approves it, and only then an explicit
 * "send" action invokes the messaging provider (HITL). A donor reply moves
 * the thread into REPLIED/NEGOTIATING.
 */

export const OUTREACH_STATUSES = [
  'DRAFT',
  'READY_FOR_REVIEW',
  'APPROVED',
  'SENT',
  'REPLIED',
  'NEGOTIATING',
  'AGREED',
  'REJECTED',
  'NO_RESPONSE',
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export interface OutreachMessage {
  subject: string;
  /** Full outreach message. */
  message: string;
  /** Shorter version for follow-ups. */
  shortVersion: string;
  /** Personalized opening line. */
  opening: string;
  valueProposition: string;
  /** The concrete placement request. */
  placementRequest: string;
  cta: string;
}

export interface OutreachDraft {
  status: OutreachStatus;
  message: OutreachMessage | null;
  /** Messaging provider name (null until sent). */
  provider: string | null;
  externalId: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const OUTREACH_TRANSITIONS: Readonly<Record<OutreachStatus, readonly OutreachStatus[]>> = {
  DRAFT: ['READY_FOR_REVIEW'],
  READY_FOR_REVIEW: ['APPROVED', 'DRAFT'],
  APPROVED: ['SENT', 'DRAFT'],
  SENT: ['REPLIED', 'NO_RESPONSE'],
  REPLIED: ['NEGOTIATING', 'AGREED', 'REJECTED'],
  NEGOTIATING: ['AGREED', 'REJECTED', 'REPLIED'],
  AGREED: [],
  REJECTED: [],
  NO_RESPONSE: ['SENT'],
};

export function canTransitionOutreach(from: OutreachStatus, to: OutreachStatus): boolean {
  return OUTREACH_TRANSITIONS[from].includes(to);
}

export function assertTransitionOutreach(from: OutreachStatus, to: OutreachStatus): void {
  if (!canTransitionOutreach(from, to)) {
    throw new ValidationError(`Invalid outreach transition: ${from} -> ${to}`);
  }
}

export function initialOutreachDraft(now = new Date().toISOString()): OutreachDraft {
  return {
    status: 'DRAFT',
    message: null,
    provider: null,
    externalId: null,
    sentAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
