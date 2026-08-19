# Placement State Machine

## States

```text
DISCOVERED
QUALIFIED
SELECTED
READY
SUBMITTED
PENDING_PUBLICATION
PUBLISHED
VERIFIED
```

Failure/manual states:

```text
FAILED
BLOCKED
NEEDS_MANUAL
VERIFICATION_FAILED
REJECTED
```

## Valid transitions

Happy path:

```text
DISCOVERED → QUALIFIED
QUALIFIED → SELECTED
SELECTED → READY             (automatic execution starts)
SELECTED → NEEDS_MANUAL      (human-in-the-loop: manual execution requested)
READY → SUBMITTED
SUBMITTED → PENDING_PUBLICATION
SUBMITTED → PUBLISHED
PENDING_PUBLICATION → PUBLISHED
NEEDS_MANUAL → PUBLISHED     (manual execution completed with proof)
PUBLISHED → VERIFIED
```

Failure transitions are explicit:

```text
READY → FAILED                    (provider create failed)
SUBMITTED → FAILED                (provider reports failed)
SUBMITTED → REJECTED              (platform rejected the submission)
SUBMITTED → NEEDS_MANUAL          (platform requires a human step)
SUBMITTED → BLOCKED               (stuck, e.g. repeated processing)
PENDING_PUBLICATION → FAILED      (provider reports failed)
PENDING_PUBLICATION → REJECTED    (platform rejected the submission)
PENDING_PUBLICATION → NEEDS_MANUAL (platform requires a human step)
PENDING_PUBLICATION → BLOCKED     (stuck)
PUBLISHED → VERIFICATION_FAILED   (evidence did not confirm the result)
```

## Attempt semantics

- **FAILED, BLOCKED, REJECTED and VERIFICATION_FAILED are terminal per
  attempt, not per opportunity.** A retry after FAILED creates a fresh
  Placement record (a new attempt); every attempt stays in the audit trail.
- **Re-execution is rejected while a previous attempt is still active**
  (SUBMITTED/PUBLISHED/...): double submission is impossible.
- **NEEDS_MANUAL is the human-in-the-loop state.** It is reachable from
  SELECTED (manual execution requested) and from the submitted pipeline
  (platform requires a human step). It exits only to PUBLISHED, and only
  with proof (external reference + public URL).
- BLOCKED/REJECTED recovery actions (re-probe, re-submit) will be defined
  in a later phase.

## Invalid examples

These must be rejected:

```text
DISCOVERED → VERIFIED
DISCOVERED → PUBLISHED
QUALIFIED → VERIFIED
NEEDS_MANUAL → FAILED
REJECTED → PUBLISHED
```

## Rules

- UI cannot directly mutate status.
- Application-level placement status changes are only allowed through the domain state machine.
- The database is the persistence layer and does not independently enforce domain transitions; no database triggers or database-level state enforcement are used in this prototype.
- Every transition should be testable.
- State changes should produce audit events where appropriate.

## Non-state read-side layers (placement plan)

The AI placement plan ("План размещений", see ADR-013) is a **derived, read-side
decision layer and introduces no states or transitions**. It classifies opportunities
into `RECOMMENDED` / `REVIEW_REQUIRED` / `NOT_RECOMMENDED` and lets the human
approve/execute them, but every resulting action goes through the ordinary transitions
above (`SELECTED → READY`, `SELECTED → NEEDS_MANUAL`, ...). The plan is never an
alternate path to publish.