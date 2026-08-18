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

`tests/e2e/nordhaus-flow.test.ts` boots the real production composition
(API + static UI serving) over HTTP on an ephemeral port and drives the
complete Nordhaus journey as the UI would:

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

plus monitoring, retry-after-failure, the manual (human-in-the-loop) path,
server-side filters, activity feed checks and negative cases (invalid
transitions → 409, validation → 400, missing resources → 404).

Deterministic by design: in-memory repositories (a real infrastructure
module), MockProvider and a fixture AI provider — no database, no external
services. Run with `pnpm test:e2e`; build the web app first
(`pnpm build:web`) to exercise the static-UI serving assertions.

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
