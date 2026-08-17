# ADR-007: State Machine Failure-Transition Scope in Phase 0

## Status

Accepted

## Decision

The Phase 0 placement state machine implements exactly the transitions documented in STATE_MACHINE.md:

- happy path: DISCOVERED → QUALIFIED → SELECTED → READY → SUBMITTED → PENDING_PUBLICATION → PUBLISHED → VERIFIED
- documented failure transitions: READY → FAILED, SUBMITTED → FAILED, PUBLISHED → VERIFICATION_FAILED
- `FAILED` and `VERIFICATION_FAILED` are terminal for now
- `BLOCKED`, `NEEDS_MANUAL` and `REJECTED` exist as states but have **no incoming transitions** until the complete failure table and recovery actions are specified

Every transition not listed above is rejected by the domain state machine.

## Context

STATE_MACHINE.md lists failure/manual states and gives failure-transition examples, but does not define the complete failure transition table or recovery transitions ("reversible only through defined recovery actions" — none defined yet). Inventing transitions now would silently create business rules.

## Consequences

Positive:

- no invented business rules; invalid transitions are rejected deterministically
- the transition table is a single registry in the domain layer, easy to extend in Phase 4
- failure/manual states are already part of the schema and enums, so later phases add transitions without schema changes

Negative:

- until Phase 4, a placement in a failure state cannot be recovered via the state machine (audit/observability only)

## Related

Campaign status values (DRAFT / ACTIVE / COMPLETED) are recorded in DOMAIN_MODEL.md.
