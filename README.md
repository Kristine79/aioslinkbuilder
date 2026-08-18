# AI OS — Link Building Module

Phases 0–5: modular-monolith monorepo with a strict domain layer, PostgreSQL (Neon) persistence, placement state machine, deterministic scoring, provider (incl. MockProvider) and AI abstractions, placement execution/verification flows, a delivery layer (`apps/api`, Hono) and a functional Russian UI (`apps/web`, Vite + React) running the real application flows on a seeded Nordhaus scenario.

Product requirements and design live in: `PRD.md`, `ARCHITECTURE.md`, `DOMAIN_MODEL.md`, `STATE_MACHINE.md`, `SCORING.md`, `INTEGRATIONS.md`, `TESTING.md`, `AI_WORKFLOWS.md`, `docs/decisions/`.

## Repository layout

```text
packages/
  domain/          pure business logic: entities, enums, state machine, capabilities, scoring, alignment, strategy, validation
  application/     repository/discovery-source/provider ports + use cases + command DTOs (Phases 1–4)
  infrastructure/  Prisma schema + migrations + Prisma repositories + in-memory repositories + seed
  ai/              AI provider abstraction + zod output schemas
  integrations/    PlacementProvider contract + MockProvider + in-memory provider registry
apps/
  api/             delivery layer: Hono routes + request validation + error mapping + composition root
                   + the Nordhaus scenario module (fixtures/environment/demo/bootstrap)
  web/             Russian UI: Vite + React + React Router; typed API client; labels only (no business logic)
tests/
  unit/            unit tests (no database), incl. delivery-layer tests (tests/unit/apps/api.test.ts)
  integration/     database tests (need DATABASE_URL)
  e2e/             scaffold for the end-to-end suite (Phase 6)
docs/decisions/    ADRs
```

Dependency direction: apps (Presentation/Delivery) → Application → Domain ← Infrastructure; domain depends on nothing. Provider and AI contracts live in `integrations`/`ai`; application depends only on those interfaces. The web app never computes business state: every value (status, allowed actions, ranking) comes from the API; all state transitions run through the application use cases and the domain state machine.

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
pnpm db:seed          # idempotent demo data: 8 categories, 8 platforms, 6 providers, Nordhaus company + campaign
pnpm demo             # deterministic end-to-end demo (in-memory, no DB): Nordhaus campaign
                      # analysis → strategy → discovery → classification → approval →
                      # execution (incl. retry) → monitoring → manual flow → verification
pnpm start            # run the whole product on one port (http://localhost:8787): API +
                      # built web UI (apps/web/dist); serves the bootstrapped Nordhaus mid-state
pnpm dev:web          # Vite dev server (http://localhost:5173, /api proxied to :8787)
pnpm dev:api          # API dev server with watch
pnpm build:web        # production web build into apps/web/dist
```

The API bootstraps the Nordhaus scenario to a mid-flight state on every start: approved opportunities, published/verified placement (Яндекс Бизнес), an in-progress submission (2ГИС, monitor from the UI), a failed attempt awaiting retry (Archi.ru), a manual placement awaiting completion (INMYROOM) and two awaiting approval. All transitions are performed through the real application use cases.

Quality gates:

```bash
pnpm typecheck        # tsc --noEmit (strict), incl. apps
pnpm lint             # ESLint (typescript-eslint, type-checked)
pnpm format:check     # Prettier check
pnpm test:unit        # unit tests, incl. delivery-layer tests (tests/unit/apps/api.test.ts)
pnpm test:integration # DB integration tests (skip when DATABASE_URL is missing)
pnpm test             # unit + integration
pnpm test:e2e         # E2E: boots the production composition over HTTP and drives the full
                      # Nordhaus journey (run pnpm build:web once first to also cover static UI serving)
```

## Phase status

| Phase | Scope                                                                                                           | Status |
| ----- | --------------------------------------------------------------------------------------------------------------- | ------ |
| 0     | structure, domain model, DB schema, state machine, provider/AI abstractions, tests                              | done   |
| 1     | company and campaign domain/application flows                                                                   | done   |
| 2     | opportunity discovery (sources), AI classification, deterministic scoring, company analysis, placement strategy | done   |
| 3     | provider abstraction + MockProvider + in-memory registry                                                        | done   |
| 4     | placement execution, monitoring, verification, evidence, audit log                                              | done   |
| 5     | Russian UI (apps/web + apps/api delivery layer)                                                                 | done   |
| 6     | E2E flow + quality pass                                                                                         | done   |

## Key decisions

- Modular monolith (ADR-001), AI is an intelligence provider, not a controller (ADR-002), provider-based integrations (ADR-003), human approval before external actions (ADR-004), PostgreSQL as single source of truth (ADR-005).
- Platform and PlacementProvider are separate entities (ADR-006).
- State machine implements only documented transitions; failure/manual states are terminal until recovery actions are defined (ADR-007).
- Tooling: pnpm workspaces, strict TS, Vitest, Prisma, zod (ADR-008).
- Application layer: ports + use cases + command DTOs; delivery (`apps/api`) deferred; repositories own ids and timestamps; writes re-validate full state; audit events with actor `system` (ADR-009).
- Opportunity discovery is a port: the seeded catalog is the first discovery source, future API/AI-research sources plug in without domain changes (ADR-010).
- Provider alignment is deterministic domain logic: verified providers that support CREATE+VERIFY are selected by type priority (API > MOCK > BROWSER > MANUAL); unverified capabilities stay explicit (never claimed). Classification and execution read provider availability from the same registry; MOCK providers are excluded at the composition/registry boundary in production.
- Failed attempts are retried with a fresh Placement record; manual placements go through NEEDS_MANUAL and reach PUBLISHED only with proof (human-in-the-loop path).
- `pnpm demo` runs the full deterministic Nordhaus scenario end-to-end on the MockProvider (in-memory, no database needed).

## Deployment target

Vercel hosting (existing project `aioslinkbuilder`), Neon PostgreSQL, database access provider-agnostic (only `DATABASE_URL` / `DIRECT_URL` env vars are required by the application).

Deployment notes (Vercel):

- `packageManager` pins `pnpm@11.9.0` (`allowBuilds`/`patchedDependencies` are pnpm 11 features).
- `postinstall` runs `prisma generate` during `pnpm install`, and the Prisma generator declares `binaryTargets = ["native", "debian-openssl-3.0.x"]`, so the Linux query engine is produced on Vercel.
- `vercel.json` runs `pnpm build:vercel` (`build:web` + `build:vercel:api`), serves `apps/web/dist` and rewrites non-API routes to `/index.html` (SPA fallback) and `/api/(.*)` to `/api/index` (the API function). The Vercel build does not run the API server; the API runs as a serverless function instead.
- The API function is `scripts/vercel-entry.ts` bundled to `api/index.mjs` (esbuild, committed to the repo). The bundle is required because Vercel leaves workspace dependencies external, and their package exports point at TypeScript sources that the Node runtime cannot import. The bundle is committed because Vercel scans the `api/` directory for functions before the build command runs — a file generated during the build is never collected. Both Vercel launcher conventions are covered: named exports (web launcher) and a default `(req, res)` adapter that feeds a standard `Request` to the same Hono app as `pnpm start` (`createApiApp` + `runNordhausBootstrap`, bootstrapped once per warm instance). Local single-port mode (`pnpm start`) is unchanged.
- `prisma@6.19.3` is published with a broken `exports` map (root export points to a `build/types.js` that is missing from the tarball), which makes every `prisma generate` attempt an auto-install. The package is patched via pnpm `patchedDependencies` (`patches/prisma@6.19.3.patch`), and the `prisma` CLI is a devDependency of `packages/infrastructure` — generation is deterministic.
- `api/health.mjs` is a Vercel function that reports DB reachability (stage-by-stage raw probe) and Prisma initialization.
