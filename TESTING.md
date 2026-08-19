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
transitions → 409, validation → 400, missing resources → 404). Since Phase 8 it
also covers the AI placement plan lifecycle over HTTP: generation, deterministic
regeneration equality, campaign-scoped routes, and a generic second company
(«Студия «Атлас»») whose plan must not leak Nordhaus-specific text.

Deterministic by design: in-memory repositories (a real infrastructure
module), MockProvider and a fixture AI provider — no database, no external
services. Run with `pnpm test:e2e`; build the web app first
(`pnpm build:web`) to exercise the static-UI serving assertions.

## Placement plan test coverage (Phase 8)

- `tests/unit/domain/placement-plan.test.ts` — reconcile rules (score preservation,
  audit-insensitive deterministic scores, BROWSER-unverified → REVIEW_PROVIDER,
  insufficient data), summary weighted automation, `pickRecommendedToStart` sorting.
- `tests/unit/ai/schemas.test.ts` — `placementPlanSchema`: valid output, unknown
  suggestion, missing `opportunityId`, extra top-level field rejection.
- `tests/unit/application/placement-plan.test.ts` — generate + persist + audit
  `PLACEMENT_PLAN_GENERATED`; override over-optimistic AI (AI says RECOMMENDED but
  score 40 → NOT_RECOMMENDED/LOW_SCORE); FAILED audit on failure; malformed AI
  output; missing/extra coverage; stale plan after a new opportunity →
  `PlanGenerationFailedError`; `NO_PLACEMENT_PLAN` before first generation.

Harness pattern: `StubAIProvider.setPlacementPlan(...)` /
`failPlacementPlan(...)` in `tests/unit/application/fakes.ts`; note that the
in-memory opportunity repository drops score/status on `create`, so tests
`create` then `update`.

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

## Real integration tests (AI + web search)

Unit-level tests cover the real integrations with injected fakes (`fetchImpl`,
stub search provider, stub query generator):

- `tests/unit/ai/opencode-client.test.ts` — success, markdown-fenced JSON,
  corrective retry (malformed JSON → succeeds; twice → hard error, no
  infinite loop), 401 (no retry, no key leakage), 429 (retry), 5xx (exhausts
  retries), network failure, 400 → validation.
- `tests/unit/integrations/duckduckgo-search.test.ts` — result parsing,
  `//duckduckgo.com/l/?uddg=` unwrapping, dedupe, `domainOf`, rate-limit
  mapping.
- `tests/unit/integrations/http-page-analysis-provider.test.ts` — MEASURED
  signals vs UNKNOWN for failures, robots handling, redirect limits.
- `tests/unit/application/web-search-platform-discovery-source.test.ts` —
  persist-then-candidate, existing-platform reuse, URL dedupe, query caps,
  partial/all-query failure behavior, deterministic platform ids.
- `tests/unit/apps/runtime-config.test.ts` — mode parsing, fail-fast when
  `real` without `OPENCODE_API_KEY`, defaults.

Credential-gated smoke tests (real OpenCode Go + DuckDuckGo calls) are not part
of the suite; they run manually with a valid `OPENCODE_API_KEY`.

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
