# ADR-005: PostgreSQL as the Operational Source of Truth

## Status
Accepted

## Decision

PostgreSQL is the single source of truth for operational state.

## Rationale

The new system must not repeat the split operational state pattern seen in earlier evolutionary prototypes.

Queues, jobs, placement states and audit records must have explicit persistence semantics.
