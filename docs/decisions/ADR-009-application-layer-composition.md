# ADR-009: Application Layer Composition (Phase 1)

## Status

Accepted

## Decision

The application layer (`packages/application`) contains:

- **repository ports** — interfaces over persistence, defined in terms of domain entities and domain drafts (e.g. `CompanyRepository.create(draft: CompanyDraft)`);
- **use cases** — small classes with constructor injection of the ports they need; each use case validates input via domain validation functions, orchestrates ports, and returns domain entities;
- **DTOs** — command types (`CreateCompanyCommand`, `UpdateCompanyCommand`, ...) that are structurally compatible with domain drafts and do not duplicate domain rules;
- **application errors** — `NotFoundError` extends the domain `DomainError`.

Rules:

- Use cases do not touch persistence implementations, frameworks or delivery concerns.
- A use case never invents data: the repository generates ids and timestamps on create; the use case merges and re-validates the **complete** resulting state on update.
- Write actions that matter (company/campaign creation) append an audit event with actor `system` (no user concept exists yet); the audit port is `AuditLogRepository.append(draft)`.
- Domain validation functions remain the only authority over business invariants (e.g. `validateCompany`, `validateCampaign`).
- The delivery layer (`apps/api`) is deferred: no HTTP, no controllers, no composition root in Phase 1. Use cases are exercised by unit tests with in-memory fakes and by integration tests through Prisma repositories.

## Context

Phase 1 implements the first vertical slice (Company → Campaign) on top of the Phase 0 skeleton. The repository port shape changed from `save(entity)` to `create(draft)`/`update(entity)` to make the "repository owns identity and timestamps" contract explicit and to avoid silent partial writes. The previously empty application layer needs a concrete composition style; the chosen style keeps use cases testable, avoids giant service classes, and leaves the API boundary open for Phase 5.

## Consequences

Positive:

- use cases are plain classes with one constructor argument per dependency; fakes are trivial in-memory maps
- invalid states cannot be persisted: every update re-validates the merged entity before write
- audit trail exists for every entity creation from day one

Negative:

- one repository method per operation is verbose (Phase 1 scope is small; acceptable)
- campaign status is a plain field for now (no campaign state machine — the placement state machine remains the only state machine); a dedicated campaign workflow may be added later if the product needs it
- application depends on domain draft types directly; if drafts diverge from commands later, a dedicated mapping layer will be introduced
