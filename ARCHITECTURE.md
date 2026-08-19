# Architecture

## 1. Architectural style

Use a **modular monolith**.

Do not use microservices for the prototype.

The system must have clear boundaries between:

- Presentation
- Application
- Domain
- Infrastructure

Suggested structure:

```text
apps/
  web/
  api/

packages/
  domain/
  application/
  infrastructure/
  ai/
  integrations/
  shared/

tests/
  unit/
  integration/
  e2e/

docs/
  decisions/
```

The exact framework-specific structure may differ, but architectural boundaries must remain.

## 2. Dependency direction

Preferred direction:

```text
Presentation
    ↓
Application
    ↓
Domain
    ↑
Infrastructure
```

Domain must not depend on UI, database implementations, HTTP clients, or specific AI vendors.

Implemented packages (Phases 1, 2, 5):

```text
apps/
  api/            HTTP delivery layer (Hono): routes + request parsing + error mapping +
                  composition root only — never business logic (ADR-009). Also hosts the
                  Nordhaus scenario module (fixtures, environment, demo, bootstrap) shared
                  with `pnpm demo` and the API server.
  web/            Russian UI (Vite + React + React Router, custom CSS design system):
                  presentation only — no business logic, no state derivation; every value
                  (status, ranking, allowed actions) comes from the API.
packages/
  domain/         entities, enums, validation, capabilities, scoring, placement state machine
  application/    repository ports + use cases + command DTOs + application errors
  infrastructure/ Prisma schema, migrations, Prisma repositories, in-memory repositories, seed
  ai/             AI provider abstraction + zod-validated output schemas
  integrations/   PlacementProvider contract (interface + DTOs); MockProvider + in-memory registry
```

Dependency direction:

```text
apps/web → apps/api (HTTP)                     (presentation; SPA fallback served by the API)
apps/api → application → domain                (routes call use cases, never mutate state directly)
infrastructure → application                   (implements repository ports; in-memory repos are
                                                shared by tests, `pnpm demo` and the API server)
infrastructure → domain                        (Prisma row <-> domain entity mapping)
infrastructure/ai/integrations depend on nothing outside their contracts
```

No package may import from a layer below itself; delivery (`apps/api`) is the only allowed
consumer of `application` + `infrastructure` composition.

## 2.1 Delivery layer and UI (Phase 5)

The delivery layer follows ADR-009: `apps/api` contains only routes, request parsing, DTO
mapping and error mapping. All state changes go through application use cases; the domain
state machine remains the only authority. The UI offers only actions the API reports as
allowed for the current state (`allowedActions` in the DTOs) — the presentation gate never
replaces domain enforcement.

HTTP API (all JSON; errors `{ error: { code, message } }`):

```text
GET  /api/meta                  categories for filters
GET  /api/company               company profile + latest AI analysis
POST /api/company/analyze       re-run AnalyzeCompanyUseCase
GET  /api/strategy              placement strategy items
GET  /api/opportunities         ranked list; server-side filters
                                category/method/status/source/placementType/risk
                                /minScore/donorQuality/minTraffic + sort
                                (score|donorQuality|traffic|relevance|lowestRisk|ease)
GET  /api/opportunities/:id     detail with intel, placements, workflow, HITL actions
POST /api/opportunities/compare donor comparison + "why AI recommends №1"
POST /api/opportunities/:id/intel            AssessOpportunityUseCase
POST /api/opportunities/:id/link-insert      LinkInsert + anchor strategy
POST /api/opportunities/:id/outreach         generate outreach draft (HITL)
POST /api/opportunities/:id/outreach/status  HITL status transition (send is human-triggered)
POST /api/opportunities/:id/negotiation/analyze  paste donor reply -> AI analysis
POST /api/opportunities/:id/negotiation/respond  human approves/sends the AI response
POST /api/opportunities/:id/approve|execute|request-manual
POST /api/placements/:id/monitor|verify|complete-manual
GET  /api/overview              campaign progress, counts, human actions, negotiations
GET  /api/activity              verifications + full audit journal
```

Error mapping: `NotFoundError` → 404 NOT_FOUND; `InvalidPlacementTransitionError` → 409
INVALID_STATE; `ValidationError` → 400 VALIDATION; `NoProviderAvailableError`/
`NoProviderAssignedError` → 422 NO_PROVIDER; `ProviderError` → 502 PROVIDER_ERROR; other → 500.

Single-port production mode: `apps/api` serves the built web app (`apps/web/dist`) with SPA
fallback; development uses Vite on :5173 with `/api` proxied to :8787 (no CORS). The API
bootstraps the Nordhaus scenario to a mid-flight state so every screen opens with live data
(verified, in-progress, failed-awaiting-retry, manual-awaiting-action and awaiting-approval
items); the user continues the flow from the UI through the real use cases.

The web app keeps zero business logic: `src/api/client.ts` is a thin typed fetch wrapper,
`src/ru.ts` holds Russian labels only, screens render API state and trigger actions; scoring,
provider selection, validation and state transitions are never duplicated on the client.

## 3. Domain entities

Core entities:

- Company
- Campaign
- PlacementCategory
- PlacementOpportunity
- Placement
- PlacementProvider
- Verification
- Evidence
- AIAnalysis
- AuditLog

Important distinction:

```text
PlacementOpportunity != Placement != Verification
```

## 4. Application layer

Primary use cases:

- CreateCampaign
- AnalyzeCompany
- GeneratePlacementStrategy
- DiscoverOpportunities
- ClassifyOpportunity
- ScoreOpportunity
- ApprovePlacement
- ExecutePlacement
- VerifyPlacement
- MonitorPlacement

Link-building intelligence use cases (`packages/application/src/use-cases/intel/`):

- AssessOpportunity — donor quality profile + page analysis + risk + Score 2.0
- GenerateLinkInsert — AI link insert assistant
- RecommendAnchor — anchor strategy
- GenerateOutreach — outreach draft (DRAFT)
- UpdateOutreachStatus — human-in-the-loop outreach transitions (SENT is human-triggered)
- AnalyzeNegotiationReply — negotiation copilot
- RespondNegotiation — human approves/sends the AI-prepared response

Use cases must not contain presentation logic.

Use cases must depend on abstractions, not concrete providers.

## 5. AI boundary

AI is an intelligence provider, not the system controller.

Preferred flow:

```text
AI
 ↓
validated structured result
 ↓
application layer
 ↓
domain rules
 ↓
persistent state
```

Never allow an LLM response to directly mutate application state.

AI provider should be abstracted so models can be changed without changing domain logic.

Real AI mode (ADR-012): `OpenCodeAIProvider` (OpenCode Go, OpenAI-compatible
chat completions) implements the full `AIProvider` contract — every method
sends a dedicated prompt and the result is validated with zod
(`validateAIOutput`) in the application layer. The client enforces a timeout,
two transport retries with backoff, and exactly one corrective retry for
malformed JSON. In real mode the `SeoMetricsProvider` is `null`, so all SEO
metrics stay `UNKNOWN` — the product never substitutes synthetic data.

## 6. Provider architecture

External placement platforms must implement a provider abstraction.

Conceptual interface:

```ts
interface PlacementProvider {
  discover(input: DiscoverInput): Promise<DiscoverResult>;
  validate(input: ValidateInput): Promise<ValidateResult>;
  create(input: CreateInput): Promise<CreateResult>;
  update(input: UpdateInput): Promise<UpdateResult>;
  getStatus(input: StatusInput): Promise<StatusResult>;
  verify(input: VerifyInput): Promise<VerifyResult>;
}
```

Not every provider must support every capability.

Capabilities must be explicit.

Provider types:

- API provider
- Browser provider
- Manual provider
- Mock provider

Application logic must not contain site-specific conditionals.

### Provider/intelligence ports

Besides the placement `PlacementProvider` port, the application defines the
following abstractions (`packages/application/src/ports/`):

- `SeoMetricsProvider` — real SEO intelligence (Ahrefs, Semrush, Similarweb,
  Google Search Console). Returns `MEASURED` data; demo mock returns
  `SYNTHETIC` data that stays explicitly labeled.
- `PageAnalysisProvider` — crawler that returns real page-level signals.
- `OutreachProvider` (messaging/email) — invoked only from the
  human-triggered SENT transition.

All mock/demo providers live in `apps/api/src/scenario/nordhaus-intel.ts` and
are clearly labeled. Real integrations plug into the same ports.

## 7. State machine

Recommended placement states:

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

All transitions must be validated by one domain-level state machine.

## 8. Data persistence

PostgreSQL is the single source of truth.

Do not use JSON files as operational state, queues, or parallel sources of truth.

If background work is needed, use a database-backed job model or an appropriate infrastructure abstraction.

## 9. Evidence

Verification must be evidence-based.

A `Verification` can reference:
- live URL
- screenshot
- extracted page evidence
- matched company name
- matched website
- expected link
- verification timestamp

## 10. Auditability

Important actions must create an audit event.

Audit event fields should include:

- timestamp
- actor
- action
- entity type
- entity ID
- metadata

## 11. Error handling

External provider calls must support:
- timeouts
- retries where safe
- explicit failure categories
- structured errors
- provider-specific diagnostics

Do not retry non-idempotent operations blindly.

## 12. Security

- secrets only in environment variables
- never expose provider credentials to the browser
- validate external input
- sanitize external content
- do not commit secrets
- provide `.env.example`

## 13. Observability

Structured logs should include where relevant:

- requestId
- campaignId
- provider
- operation
- duration
- status
- error category

Never log secrets.

## 14. Why modular monolith

The prototype needs low operational complexity while preserving clear domain boundaries.

A modular monolith allows individual components to be extracted later if real scale requires it.
