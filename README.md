# AI OS — Link Building Module

Phase 0 foundation for the Link Building Module of the AI OS platform: modular-monolith monorepo with a strict domain layer, PostgreSQL (Neon) persistence, placement state machine, provider and AI abstractions.

Product requirements and design live in: `PRD.md`, `ARCHITECTURE.md`, `DOMAIN_MODEL.md`, `STATE_MACHINE.md`, `SCORING.md`, `INTEGRATIONS.md`, `TESTING.md`, `AI_WORKFLOWS.md`, `docs/decisions/`.

## Repository layout

```text
packages/
  domain/          pure business logic: entities, enums, state machine, capabilities, scoring, validation
  application/     repository ports + use cases + command DTOs (Phases 1, 2)
  infrastructure/  Prisma schema + migrations + Prisma repositories + seed
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
pnpm db:seed          # idempotent demo data: 8 categories, 8 platforms, 2 mock providers, Nordhaus company + campaign
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
| 1     | company and campaign domain/application flows                                      | done        |
| 2     | opportunity discovery, classification, scoring                                     | in progress |
| 3     | provider implementations + MockProvider                                            | not started |
| 4     | placement execution, verification, evidence, audit log                             | not started |
| 5     | Russian UI                                                                         | not started |
| 6     | E2E flow + quality pass                                                            | not started |

## Key decisions

- Modular monolith (ADR-001), AI is an intelligence provider, not a controller (ADR-002), provider-based integrations (ADR-003), human approval before external actions (ADR-004), PostgreSQL as single source of truth (ADR-005).
- Platform and PlacementProvider are separate entities (ADR-006).
- State machine implements only documented transitions; failure/manual states are terminal until recovery actions are defined (ADR-007).
- Tooling: pnpm workspaces, strict TS, Vitest, Prisma, zod (ADR-008).
- Application layer: ports + use cases + command DTOs; delivery (`apps/api`) deferred; repositories own ids and timestamps; writes re-validate full state; audit events with actor `system` (ADR-009).

## Deployment target

Vercel hosting (existing project `aioslinkbuilder`), Neon PostgreSQL, database access provider-agnostic (only `DATABASE_URL` / `DIRECT_URL` env vars are required by the application).

Deployment notes (Vercel):

- `packageManager` pins `pnpm@11.9.0` (`allowBuilds`/`patchedDependencies` are pnpm 11 features).
- `postinstall` runs `prisma generate` during `pnpm install`, and the Prisma generator declares `binaryTargets = ["native", "debian-openssl-3.0.x"]`, so the Linux query engine is produced on Vercel (no `buildCommand`, no output directory).
- `prisma@6.19.3` is published with a broken `exports` map (root export points to a `build/types.js` that is missing from the tarball). This makes `require.resolve('prisma')` fail and every `prisma generate` attempt an auto-install (`pnpm add @prisma/client`, which recursed when combined with a postinstall). The package is patched via pnpm `patchedDependencies` (`patches/prisma@6.19.3.patch` restoring `build/types.js` as a re-export of `./index.js`), and `prisma` CLI is declared as a devDependency of `packages/infrastructure` (the schema owner) so both resolve from the same `node_modules` — auto-install no longer triggers, generation is deterministic.
- `api/health.mjs` is a Vercel function that reports DB reachability (stage-by-stage raw probe) and Prisma initialization.
