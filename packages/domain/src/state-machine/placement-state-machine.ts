import type { PlacementStatus } from '../enums/placement-status.js';
import { InvalidPlacementTransitionError } from '../errors.js';

/**
 * Transition table for placement lifecycle.
 *
 * Happy path and failure transitions follow STATE_MACHINE.md. REJECTED,
 * NEEDS_MANUAL and BLOCKED are reachable outcomes of provider monitoring
 * (platform rejection, human action required, stuck in processing). Manual
 * execution completes via NEEDS_MANUAL -> PUBLISHED. FAILED, BLOCKED,
 * REJECTED and VERIFICATION_FAILED are terminal for a given attempt: a new
 * attempt is a new Placement record (retry semantics), recovery actions for
 * BLOCKED/REJECTED will be defined in a later phase.
 */
export const PLACEMENT_TRANSITIONS: Readonly<Record<PlacementStatus, readonly PlacementStatus[]>> =
  {
    DISCOVERED: ['QUALIFIED'],
    QUALIFIED: ['SELECTED'],
    SELECTED: ['READY', 'NEEDS_MANUAL'],
    READY: ['SUBMITTED', 'FAILED'],
    SUBMITTED: [
      'PENDING_PUBLICATION',
      'PUBLISHED',
      'FAILED',
      'REJECTED',
      'NEEDS_MANUAL',
      'BLOCKED',
    ],
    PENDING_PUBLICATION: ['PUBLISHED', 'REJECTED', 'NEEDS_MANUAL', 'BLOCKED'],
    PUBLISHED: ['VERIFIED', 'VERIFICATION_FAILED'],
    VERIFIED: [],
    FAILED: [],
    BLOCKED: [],
    NEEDS_MANUAL: ['PUBLISHED'],
    VERIFICATION_FAILED: [],
    REJECTED: [],
  };

export function canTransitionPlacement(from: PlacementStatus, to: PlacementStatus): boolean {
  return PLACEMENT_TRANSITIONS[from].includes(to);
}

export function assertTransitionPlacement(from: PlacementStatus, to: PlacementStatus): void {
  if (!canTransitionPlacement(from, to)) {
    throw new InvalidPlacementTransitionError(from, to);
  }
}
