# AI Coding Agent Instructions

## Mission

Build the AI OS Link Building Module according to the repository documentation.

Before changing code, read:

1. `PRD.md`
2. `ARCHITECTURE.md`
3. `DOMAIN_MODEL.md`
4. `STATE_MACHINE.md`
5. relevant ADRs
6. `SEOFLOW_REFERENCE.md` when domain context is needed

## Critical rules

- This is a new standalone application.
- Do not import or depend on SEOFlow code.
- Do not copy SEOFlow architecture.
- Do not use JSON files as operational state.
- Do not put business logic in React components.
- Do not call external providers directly from the domain layer.
- Do not call LLMs directly from the domain layer.
- All provider integrations use abstractions.
- All AI output is schema validated.
- AI must not directly mutate business state.
- All placement state transitions go through the domain state machine.
- Do not invent API capabilities.
- Do not silently introduce architectural changes.
- New architectural decisions require an ADR.
- New business rules require tests.

## Development style

Prefer:
- small focused modules
- explicit types
- strict TypeScript
- dependency inversion
- deterministic business logic
- clear errors
- testable use cases

Avoid:
- premature abstractions
- giant service classes
- `any`
- hidden global state
- duplicated business logic
- magic strings
- site-specific conditionals
- unnecessary frameworks

## Workflow

Work incrementally.

### Phase 0
Create:
- repository structure
- documentation
- architecture skeleton
- domain model
- database schema
- state machine
- provider interfaces
- initial tests

Do not implement UI or real external integrations during Phase 0.

### Phase 1
Implement company and campaign domain/application flows.

### Phase 2
Implement opportunity discovery, classification and scoring.

### Phase 3
Implement provider abstraction and MockProvider.

### Phase 4
Implement placement execution, verification, evidence and audit log.

### Phase 5
Implement Russian UI.

### Phase 6
Implement E2E flow and final quality pass.

## Quality gates

After each phase run:

- typecheck
- lint
- unit tests
- integration tests where applicable
- E2E tests for completed flows

Inspect changed files before moving to the next phase.

## When blocked

Do not guess.

If requirements conflict:
1. identify the conflict
2. explain the impact
3. propose the smallest safe change
4. wait for approval if the change affects architecture or product scope

## Definition of done

A feature is complete only when:
- implementation works
- types pass
- lint passes
- relevant tests pass
- failure cases are handled
- documentation is updated
- no architectural boundary is violated
