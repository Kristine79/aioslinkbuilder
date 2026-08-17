import type { PlacementStatus } from '../enums/placement-status.js';
import { InvalidPlacementTransitionError } from '../errors.js';

/**
 * Transition table for placement lifecycle.
 *
 * Happy path and failure transitions follow STATE_MACHINE.md.
 * Failure/manual states FAILED and VERIFICATION_FAILED are terminal for now:
 * recovery actions will be defined in a later phase. BLOCKED, NEEDS_MANUAL and
 * REJECTED exist as states but have no incoming transitions until the complete
 * failure table and recovery actions are specified.
 */
export const PLACEMENT_TRANSITIONS: Readonly<Record<PlacementStatus, readonly PlacementStatus[]>> =
  {
    DISCOVERED: ['QUALIFIED'],
    QUALIFIED: ['SELECTED'],
    SELECTED: ['READY'],
    READY: ['SUBMITTED', 'FAILED'],
    SUBMITTED: ['PENDING_PUBLICATION', 'PUBLISHED', 'FAILED'],
    PENDING_PUBLICATION: ['PUBLISHED'],
    PUBLISHED: ['VERIFIED', 'VERIFICATION_FAILED'],
    VERIFIED: [],
    FAILED: [],
    BLOCKED: [],
    NEEDS_MANUAL: [],
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
