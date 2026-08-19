# AI Backlink OS

Phases 0–6: modular-monolith monorepo with a strict domain layer, PostgreSQL (Neon) persistence, placement state machine, deterministic scoring, provider (incl. MockProvider) and AI abstractions, placement execution/verification flows, a delivery layer (`apps/api`, Hono) and a functional Russian UI (`apps/web`, Vite + React).

The prototype is evolving into an **AI Link Building Operations Platform / Copilot**: AI automates research, qualification, preparation and routine work, while humans handle negotiation, approval and cases where automation is impossible. It is not a fully autonomous link-building bot.

Product requirements and design live in: `PRD.md`, `ARCHITECTURE.md`, `DOMAIN_MODEL.md`, `STATE_MACHINE.md`, `SCORING.md`, `INTEGRATIONS.md`, `TESTING.md`, `AI_WORKFLOWS.md`, `docs/decisions/`. Operational playbooks: `docs/LINK_BUILDING_OPERATIONS.md` (end-to-end flow), `docs/DEMO.md` (demo transcript), `docs/PROJECT_STATUS.md` (capability classification). Production: `docs/PRODUCTION_READINESS.md`, `docs/PRODUCTION_ARCHITECTURE.md`, `docs/PRODUCTION_ROADMAP.md`.

## Link-building intelligence features

- **Donor quality / SEO intelligence** — traffic, geography, keyword profile,
  backlink profile, authority, spam risk, indexation, topical relevance,
  audience/geographic match, placement quality, automation potential. Every
  external metric carries explicit provenance: `MEASURED` / `AI_ESTIMATED` /
  `INTERNAL` / `SYNTHETIC` / `UNKNOWN`. Demo data is clearly labeled.
- **Page-level analysis** — a donor domain and the specific placement page are
  separate entities (title, page type, topical relevance, link-insert
  suitability, indexation, outbound-link signals, suggested placement).
- **Placement type expansion** — `LINK_INSERT`, `GUEST_POST`, `RESOURCE_PAGE`,
  `PARTNER_PAGE` with per-type recommended workflows.
- **Link insert assistant** — web-page-aware anchor + alternatives + insertion
  point + contextual text + naturalness explanation + confidence.
- **Anchor strategy** — explicit anchor classification (exact/partial match,
  branded, generic, url, long-tail) with rationale; profile-aware when a
  campaign anchor profile exists.
- **Donor risk / spam analysis** — deterministic signals (LOW/MEDIUM/HIGH).
- **Opportunity Score 2.0** — separates relevance / donor quality / placement
  quality / execution / risk into a transparent overall (weights in SCORING.md).
- **Outreach assistant** (HITL) — subject, message, short version, opening,
  value proposition, placement request, CTA. Sending is only ever human-triggered.
- **Negotiation copilot** (HITL) — paste a donor reply → AI classifies the
  intent and prepares a suggested response, strategy, price range, fallback
  and risks; the human approves and sends.
- **Human-in-the-loop workspace** — "Требует действия" cards with WHY / WHAT
  AI prepared / WHAT the human must do, plus a primary action.
- **Donor comparison** + "Почему AI рекомендует №1".
- **Better opportunity list** — server-side filters (category, method, status,
  source, placement type, risk, min score, min donor quality, min traffic) and
  sorting (score / donor quality / traffic / relevance / lowest risk / ease).
- **Campaign links / anchor profile** view, and a dashboard health overview.
- **AI placement plan** ("План размещений") — one batched AI call interprets the
  deterministic signals (score, donor quality, risk, provider availability, method)
  into a per-opportunity decision: `RECOMMENDED` (with next action + automation mode),
  `REVIEW_REQUIRED`, or `NOT_RECOMMENDED` (with reason). The domain re-reconciles the
  AI decision map against current state, so the final bucket/action/automation is always
  deterministic; see ADR-013.

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

New values were added to the `PlacementType` and `AIAnalysisType` enums for the link-building-intelligence feature, and `AIAnalysisType.PLACEMENT_PLAN` for the placement plan. The migrations `.../prisma/migrations/20260818120000_link_building_intel/migration.sql` and `.../prisma/migrations/20260819120000_placement_plan/migration.sql` must be applied (`prisma migrate dev`) when the database is reachable; the in-memory demo/API already use the new types directly.

## Setup and commands

```bash
pnpm install
pnpm db:generate      # generate Prisma Client
pnpm db:migrate       # apply migrations (needs .env)
pnpm db:seed          # idempotent demo data: 8 categories, 8 platforms, 6 providers, Nordhaus company + campaign
pnpm demo             # deterministic end-to-end demo (in-memory, no DB): Nordhaus campaign
                      # analysis → strategy → discovery → classification → approval →
                      # execution (incl. retry) → monitoring → manual flow → verification
                      # → AI placement plan ([4e] per-platform decisions + summary)
pnpm start            # run the whole product on one port (http://localhost:8787): API +
                      # built web UI (apps/web/dist). Production: Prisma-backed over
                      # PostgreSQL (Neon) — data persists across restarts.
                      # Outside NODE_ENV=production with a unreachable database it
                      # falls back to the in-memory Nordhaus demo with an explicit
                      # warning (no persistence)
pnpm dev:web          # Vite dev server (http://localhost:5173, /api proxied to :8787)
pnpm dev:api          # API dev server with watch
pnpm build:web        # production web build into apps/web/dist
```

In production (Vercel serverless, or `NODE_ENV=production`) the app is
persistence-first: it fails fast when PostgreSQL is unreachable and never
silently falls back to in-memory data (ADR-014). `pnpm db:seed` must have
been run once so the platform catalog (categories/platforms/providers)
exists — users then create companies and campaigns via the UI, and they
survive cold starts and multiple serverless instances.

## Real AI and web discovery (production mode)

The default demo mode is deterministic and makes no network calls. To run real
AI (OpenCode Go) and real web discovery (DuckDuckGo), set the mode variables —
see `.env.example` and `INTEGRATIONS.md`:

```bash
AI_MODE=real DISCOVERY_MODE=real OPENCODE_API_KEY=sk-... pnpm start
```

- `AI_MODE=real` — every AI capability runs on the configured model
  (`OPENCODE_MODEL`, default `deepseek-v4-pro`); page analysis is real HTTP
  (`http-page-analysis`); without a paid SEO metrics source all metrics are
  honestly `UNKNOWN` (`нет данных` in the UI).
- `DISCOVERY_MODE=real` — the «Найти площадки» action (and the seed) plan
  search intents via AI and search the web for real sites; found sites are
  persisted into the platform catalog and labeled `web-search`.
- Real modes without `OPENCODE_API_KEY` fail fast at startup — the product
  never silently falls back to demo data.
- UI provenance is explicit: `OpenCode Go` provider label, `Веб-поиск` source
  chip, `измерено`/`оценка AI`/`демо-данные`/`нет данных` metric badges.

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

| Phase | Scope                                                                                                                            | Status |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 0     | structure, domain model, DB schema, state machine, provider/AI abstractions, tests                                               | done   |
| 1     | company and campaign domain/application flows                                                                                    | done   |
| 2     | opportunity discovery (sources), AI classification, deterministic scoring, company analysis, placement strategy                  | done   |
| 3     | provider abstraction + MockProvider + in-memory registry                                                                         | done   |
| 4     | placement execution, monitoring, verification, evidence, audit log                                                               | done   |
| 5     | Russian UI (apps/web + apps/api delivery layer)                                                                                  | done   |
| 6     | E2E flow + quality pass                                                                                                          | done   |
| 7     | link-building intelligence: donor quality, page analysis, anchor/link insert, outreach, negotiation, HITL, Score 2.0, comparison | done   |
| 8     | AI placement plan ("План размещений"): batched AI decision map + deterministic re-reconciliation + API + UI + tests + docs       | done   |

## Key decisions

- Modular monolith (ADR-001), AI is an intelligence provider, not a controller (ADR-002), provider-based integrations (ADR-003), human approval before external actions (ADR-004), PostgreSQL as single source of truth (ADR-005).
- Platform and PlacementProvider are separate entities (ADR-006).
- State machine implements only documented transitions; failure/manual states are terminal until recovery actions are defined (ADR-007).
- Tooling: pnpm workspaces, strict TS, Vitest, Prisma, zod (ADR-008).
- Application layer: ports + use cases + command DTOs; delivery (`apps/api`) deferred; repositories own ids and timestamps; writes re-validate full state; audit events with actor `system` (ADR-009).
- Opportunity discovery is a port: the seeded catalog is the first discovery source, future API/AI-research sources plug in without domain changes (ADR-010).
- Link-building intelligence (donor quality, page analysis, anchor/link insert, outreach, negotiation, Score 2.0, risk) is stored as typed JSON on the opportunity metadata through a single helper, with new provider ports (SEO metrics / page analysis / outreach) and zod-validated AI methods (ADR-011).
- Provider alignment is deterministic domain logic: verified providers that support CREATE+VERIFY are selected by type priority (API > MOCK > BROWSER > MANUAL); unverified capabilities stay explicit (never claimed). Classification and execution read provider availability from the same registry; MOCK providers are excluded at the composition/registry boundary in production.
- Failed attempts are retried with a fresh Placement record; manual placements go through NEEDS_MANUAL and reach PUBLISHED only with proof (human-in-the-loop path).
- `pnpm demo` runs the full deterministic Nordhaus scenario end-to-end on the MockProvider (in-memory, no database needed).
- The AI placement plan is generated by the deterministic ScenarioAIProvider, persisted as an `AIAnalysis` of type `PLACEMENT_PLAN`, and re-reconciled against current state on every read; AI interprets signals but never writes business state (ADR-013).
- Production persistence: the Vercel deployment and `pnpm start` run the Prisma-backed environment over PostgreSQL (Neon) via the shared `ApiEnvironment` contract; the delivery layer reads audit/company data through the repository ports, and the serverless bundle keeps `@prisma/client` external (ADR-014).

## Deployment target

Vercel hosting (existing project `aioslinkbuilder`), Neon PostgreSQL, database access provider-agnostic (only `DATABASE_URL` / `DIRECT_URL` env vars are required by the application).

Deployment notes (Vercel):

- `packageManager` pins `pnpm@11.9.0` (`allowBuilds`/`patchedDependencies` are pnpm 11 features).
- `postinstall` runs `prisma generate` during `pnpm install`, and the Prisma generator declares `binaryTargets = ["native", "debian-openssl-3.0.x"]`, so the Linux query engine is produced on Vercel.
- `vercel.json` runs `pnpm build:vercel` (`build:web` + `build:vercel:api`), serves `apps/web/dist` and rewrites non-API routes to `/index.html` (SPA fallback) and `/api/(.*)` to `/api/index` (the API function). The Vercel build does not run the API server; the API runs as a serverless function instead.
- The API function is `scripts/vercel-entry.ts` bundled to `api/index.mjs` (esbuild, committed to the repo). The bundle is required because Vercel leaves workspace dependencies external, and their package exports point at TypeScript sources that the Node runtime cannot import. The bundle is committed because Vercel scans the `api/` directory for functions before the build command runs — a file generated during the build is never collected. Both Vercel launcher conventions are covered: named exports (web launcher) and a default `(req, res)` adapter that feeds a standard `Request` to the same Hono app as `pnpm start`. Persistence is PostgreSQL via the Prisma-backed environment (`createPrismaEnvironment`), built once per warm instance; `@prisma/client` stays external to the bundle so the generated client and query engine resolve from `node_modules` at runtime (same proven path as `api/health.mjs`, ADR-014).
- `prisma@6.19.3` is published with a broken `exports` map (root export points to a `build/types.js` that is missing from the tarball), which makes every `prisma generate` attempt an auto-install. The package is patched via pnpm `patchedDependencies` (`patches/prisma@6.19.3.patch`), and the `prisma` CLI is a devDependency of `packages/infrastructure` — generation is deterministic.
- `api/health.mjs` is a Vercel function that reports DB reachability (stage-by-stage raw probe) and Prisma initialization.
