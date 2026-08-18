import { describe, expect, it } from 'vitest';

import {
  InvalidPlacementTransitionError,
  PLACEMENT_STATUSES,
  PLACEMENT_TRANSITIONS,
  assertTransitionPlacement,
  canTransitionPlacement,
} from '@aios/domain';
import type { PlacementStatus } from '@aios/domain';

describe('placement state machine', () => {
  describe('valid transitions', () => {
    const valid: ReadonlyArray<readonly [PlacementStatus, PlacementStatus]> = [
      ['DISCOVERED', 'QUALIFIED'],
      ['QUALIFIED', 'SELECTED'],
      ['SELECTED', 'READY'],
      ['SELECTED', 'NEEDS_MANUAL'],
      ['NEEDS_MANUAL', 'PUBLISHED'],
      ['READY', 'SUBMITTED'],
      ['SUBMITTED', 'PENDING_PUBLICATION'],
      ['SUBMITTED', 'PUBLISHED'],
      ['PENDING_PUBLICATION', 'PUBLISHED'],
      ['PUBLISHED', 'VERIFIED'],
      ['READY', 'FAILED'],
      ['SUBMITTED', 'FAILED'],
      ['SUBMITTED', 'REJECTED'],
      ['SUBMITTED', 'NEEDS_MANUAL'],
      ['SUBMITTED', 'BLOCKED'],
      ['PENDING_PUBLICATION', 'REJECTED'],
      ['PENDING_PUBLICATION', 'NEEDS_MANUAL'],
      ['PENDING_PUBLICATION', 'BLOCKED'],
      ['PUBLISHED', 'VERIFICATION_FAILED'],
    ];

    it.each(valid)('accepts %s -> %s', (from, to) => {
      expect(canTransitionPlacement(from, to)).toBe(true);
      expect(() => assertTransitionPlacement(from, to)).not.toThrow();
    });
  });

  describe('invalid transitions', () => {
    const invalid: ReadonlyArray<readonly [PlacementStatus, PlacementStatus]> = [
      ['DISCOVERED', 'VERIFIED'],
      ['DISCOVERED', 'PUBLISHED'],
      ['QUALIFIED', 'VERIFIED'],
      ['DISCOVERED', 'SUBMITTED'],
      ['QUALIFIED', 'PUBLISHED'],
      ['SELECTED', 'SUBMITTED'],
      ['READY', 'PUBLISHED'],
      ['SUBMITTED', 'VERIFIED'],
      ['PUBLISHED', 'SUBMITTED'],
      ['VERIFIED', 'PUBLISHED'],
      ['DISCOVERED', 'FAILED'],
      ['QUALIFIED', 'FAILED'],
      ['SELECTED', 'FAILED'],
      ['QUALIFIED', 'NEEDS_MANUAL'],
      ['READY', 'NEEDS_MANUAL'],
      ['NEEDS_MANUAL', 'VERIFIED'],
      ['NEEDS_MANUAL', 'FAILED'],
      ['VERIFIED', 'VERIFICATION_FAILED'],
      ['FAILED', 'READY'],
      ['FAILED', 'SUBMITTED'],
      ['REJECTED', 'PUBLISHED'],
      ['BLOCKED', 'PUBLISHED'],
    ];

    it.each(invalid)('rejects %s -> %s', (from, to) => {
      expect(canTransitionPlacement(from, to)).toBe(false);
      expect(() => assertTransitionPlacement(from, to)).toThrow(InvalidPlacementTransitionError);
    });

    it('reports the invalid transition in the error', () => {
      try {
        assertTransitionPlacement('DISCOVERED', 'VERIFIED');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidPlacementTransitionError);
        if (error instanceof InvalidPlacementTransitionError) {
          expect(error.from).toBe('DISCOVERED');
          expect(error.to).toBe('VERIFIED');
          expect(error.message).toContain('DISCOVERED -> VERIFIED');
        }
      }
    });
  });

  describe('transition table consistency', () => {
    it('covers every state exactly once as a source', () => {
      const sources = Object.keys(PLACEMENT_TRANSITIONS) as PlacementStatus[];
      expect(sources.sort()).toEqual([...PLACEMENT_STATUSES].sort());
    });

    it('only references known states as targets', () => {
      for (const targets of Object.values(PLACEMENT_TRANSITIONS)) {
        for (const target of targets) {
          expect(PLACEMENT_STATUSES).toContain(target);
        }
      }
    });

    it('has no self-transitions', () => {
      for (const [source, targets] of Object.entries(PLACEMENT_TRANSITIONS)) {
        expect(targets).not.toContain(source);
      }
    });
  });

  describe('failure and manual states', () => {
    it('FAILED, BLOCKED, VERIFICATION_FAILED and REJECTED have no outgoing transitions', () => {
      for (const state of ['FAILED', 'BLOCKED', 'VERIFICATION_FAILED', 'REJECTED'] as const) {
        expect(PLACEMENT_TRANSITIONS[state]).toEqual([]);
      }
    });

    it('NEEDS_MANUAL only transitions to PUBLISHED (manual completion)', () => {
      expect(PLACEMENT_TRANSITIONS.NEEDS_MANUAL).toEqual(['PUBLISHED']);
    });

    it('BLOCKED, NEEDS_MANUAL and REJECTED are reachable from the submitted pipeline', () => {
      const submittedTargets = PLACEMENT_TRANSITIONS.SUBMITTED;
      const pendingTargets = PLACEMENT_TRANSITIONS.PENDING_PUBLICATION;
      expect(submittedTargets).toContain('BLOCKED');
      expect(submittedTargets).toContain('NEEDS_MANUAL');
      expect(submittedTargets).toContain('REJECTED');
      expect(pendingTargets).toContain('BLOCKED');
      expect(pendingTargets).toContain('NEEDS_MANUAL');
      expect(pendingTargets).toContain('REJECTED');
    });
  });
});
