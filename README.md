# AI OS — Link Building Module

Phase 0 foundation for the Link Building Module of the AI OS platform: modular-monolith monorepo with a strict domain layer, PostgreSQL (Neon) persistence, placement state machine, provider and AI abstractions.

Product requirements and design live in: `PRD.md`, `ARCHITECTURE.md`, `DOMAIN_MODEL.md`, `STATE_MACHINE.md`, `SCORING.md`, `INTEGRATIONS.md`, `TESTING.md`, `AI_WORKFLOWS.md`, `docs/decisions/`.

## Repository layout

```text
packages/
  domain/          pure business logic: entities, enums, state machine, capabilities, scoring, validation
  application/     use cases (Phase 1+) + repository ports
  infrastructure/  Prisma schema + migrations + Prisma client factory
  ai/              AI provider abstraction + zod output schemas
  integrations/    PlacementProvider contract (interface + DTOs); implementations in Phase 3
tests/
  unit/            unit tests (no database)
  integration/     database tests (need DATABASE_URL)
  e2e/             scaffold for the end-to-end suite (Phase 6)
docs/decisions/    ADRs
```

Dependency direction: Presentation → Application → Domain ← Infrastructure; domain depends on nothing. Provider and AI contracts live in `integrations`/`ai`; application depends only on those interfaces.

## Prerequisites

- Node.js >= 22
- pnpm >= 10 (v11 recommended)

## Database (Neon PostgreSQL)

The project uses Neon PostgreSQL. There is no local PostgreSQL requirement.

1. Copy `.env.example` to `.env` and fill in the two variables from the Neon dashboard (Connect → Prisma):
   - `DATABASE_URL` — pooled connection (pgbouncer transaction mode), used at runtime.
   - `DIRECT_URL` — direct (unpooled) connection, used by Prisma Migrate.
2. Do not commit `.env` (it is gitignored).

Local dev network note: on some networks the Neon direct endpoint is unreachable while the pooled endpoint works; if `prisma migrate dev` fails with `P1001`, point `DIRECT_URL` at the pooled endpoint for local work (see ADR-008). On Vercel/CI use the native direct endpoint.

## Setup and commands

```bash
pnpm install
pnpm db:generate      # generate Prisma Client
pnpm db:migrate       # apply migrations (needs .env)
```

Quality gates:

```bash
pnpm typecheck        # tsc --noEmit (strict)
pnpm lint             # ESLint (typescript-eslint, type-checked)
pnpm format:check     # Prettier check
pnpm test:unit        # unit tests
pnpm test:integration # DB integration tests (skip when DATABASE_URL is missing)
pnpm test             # unit + integration
pnpm test:e2e         # E2E scaffold (no tests until Phase 6)
```

## Phase status

| Phase | Scope                                                                              | Status      |
| ----- | ---------------------------------------------------------------------------------- | ----------- |
| 0     | structure, domain model, DB schema, state machine, provider/AI abstractions, tests | done        |
| 1     | company and campaign domain/application flows                                      | not started |
| 2     | opportunity discovery, classification, scoring                                     | not started |
| 3     | provider implementations + MockProvider                                            | not started |
| 4     | placement execution, verification, evidence, audit log                             | not started |
| 5     | Russian UI                                                                         | not started |
| 6     | E2E flow + quality pass                                                            | not started |

## Key decisions

- Modular monolith (ADR-001), AI is an intelligence provider, not a controller (ADR-002), provider-based integrations (ADR-003), human approval before external actions (ADR-004), PostgreSQL as single source of truth (ADR-005).
- Platform and PlacementProvider are separate entities (ADR-006).
- State machine implements only documented transitions; failure/manual states are terminal until recovery actions are defined (ADR-007).
- Tooling: pnpm workspaces, strict TS, Vitest, Prisma, zod (ADR-008).

## Deployment target

Vercel hosting, Neon PostgreSQL, database access provider-agnostic (only `DATABASE_URL` / `DIRECT_URL` env vars are required by the application).
