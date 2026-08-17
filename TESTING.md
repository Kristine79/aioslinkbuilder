# Testing Strategy

## Test levels

### Unit tests

Cover:
- score calculation
- score breakdown
- state transitions
- provider capability checks
- validation
- deduplication
- domain rules

### Integration tests

Cover:
- database repositories
- application use cases
- provider adapters
- AI provider abstraction

### E2E tests

Minimum happy path:

```text
Create Campaign
→ Analyze Company
→ Discover Opportunities
→ Score
→ Select
→ Approve
→ Mock Placement
→ Verify
```

## Negative cases

At minimum:

- invalid company data
- duplicate opportunity
- provider timeout
- provider unsupported capability
- placement failure
- verification failure
- invalid state transition
- malformed AI response

## Test principles

- tests must be deterministic
- external APIs should be mocked in automated tests
- AI should be mocked for domain/application tests
- E2E should use MockProvider
- avoid testing implementation details
- test business behavior and contracts

## Quality gates

Before a phase is considered complete:

- typecheck passes
- lint passes
- unit tests pass
- integration tests pass where applicable
- E2E passes for implemented flow
