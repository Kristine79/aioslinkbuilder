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

Implemented packages (Phases 1, 2):

```text
apps/             not created yet — delivery layer (HTTP API, web UI) arrives in a later phase;
                  `apps/api` will contain HTTP routes, validation of requests and a composition
                  root only, never business logic (ADR-009)
packages/
  domain/         entities, enums, validation, capabilities, scoring, placement state machine
  application/    repository ports + use cases + command DTOs + application errors
  infrastructure/ Prisma schema, migrations, Prisma repositories, seed
  ai/             AI provider abstraction + zod-validated output schemas
  integrations/   PlacementProvider contract (interface + DTOs); implementations later
```

Dependency direction:

```text
application → domain           (use cases orchestrate ports, validate via domain functions)
infrastructure → application   (implements repository ports)
infrastructure → domain        (Prisma row <-> domain entity mapping)
infrastructure/ai/integrations depend on nothing outside their contracts
```

No package may import from a layer below itself; delivery (`apps/api`) is the only allowed
consumer of `application` + `infrastructure` composition.

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
