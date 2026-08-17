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
      ['READY', 'SUBMITTED'],
      ['SUBMITTED', 'PENDING_PUBLICATION'],
      ['SUBMITTED', 'PUBLISHED'],
      ['PENDING_PUBLICATION', 'PUBLISHED'],
      ['PUBLISHED', 'VERIFIED'],
      ['READY', 'FAILED'],
      ['SUBMITTED', 'FAILED'],
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
      ['VERIFIED', 'VERIFICATION_FAILED'],
      ['FAILED', 'READY'],
      ['FAILED', 'SUBMITTED'],
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
    it('FAILED, BLOCKED, NEEDS_MANUAL, VERIFICATION_FAILED and REJECTED have no outgoing transitions yet', () => {
      for (const state of ['FAILED', 'BLOCKED', 'NEEDS_MANUAL', 'VERIFICATION_FAILED', 'REJECTED'] as const) {
        expect(PLACEMENT_TRANSITIONS[state]).toEqual([]);
      }
    });

    it('BLOCKED, NEEDS_MANUAL and REJECTED have no incoming transitions until recovery actions are defined', () => {
      const allTargets = Object.values(PLACEMENT_TRANSITIONS).flat();
      expect(allTargets).not.toContain('BLOCKED');
      expect(allTargets).not.toContain('NEEDS_MANUAL');
      expect(allTargets).not.toContain('REJECTED');
    });
  });
});
