# ADR-002: Separate AI Intelligence from Deterministic Business Logic

## Status
Accepted

## Decision

Use AI for semantic analysis and recommendations. Use deterministic application/domain code for scoring, validation, state transitions, permissions, persistence and verification rules.

## Rationale

LLMs are useful for semantic interpretation but should not control critical business state.

This improves:
- reproducibility
- testability
- explainability
- reliability
