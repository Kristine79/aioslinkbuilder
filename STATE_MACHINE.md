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

```text
DISCOVERED → QUALIFIED
QUALIFIED → SELECTED
SELECTED → READY
READY → SUBMITTED
SUBMITTED → PENDING_PUBLICATION
SUBMITTED → PUBLISHED
PENDING_PUBLICATION → PUBLISHED
PUBLISHED → VERIFIED
```

Failure transitions must be explicit and reversible only through defined recovery actions.

Examples:

```text
READY → FAILED
SUBMITTED → FAILED
PUBLISHED → VERIFICATION_FAILED
```

## Invalid examples

These must be rejected:

```text
DISCOVERED → VERIFIED
DISCOVERED → PUBLISHED
QUALIFIED → VERIFIED
```

## Rules

- UI cannot directly mutate status.
- Database writes cannot bypass transition validation.
- Every transition should be testable.
- State changes should produce audit events where appropriate.
