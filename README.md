# AI Backlink OS

AI-powered platform for discovering, evaluating and acquiring high-quality backlinks.

**AI Backlink OS** is an AI link-building operations platform / copilot. It runs
the end-to-end workflow:

```text
DISCOVER → QUALIFY → CREATE → OUTREACH → NEGOTIATE → PLACE → VERIFY
```

AI performs the research, analysis, qualification, preparation and routine
work. **Humans remain responsible for approval, negotiation, communication,
and any case where external execution requires human involvement.** This is
not a fully autonomous backlink bot — it is a serious operations system in
which AI prepares decisions and humans make and execute them.

The architecture is production-oriented (strict TypeScript, modular monolith,
deterministic domain core, provider abstractions, schema-validated AI),
but the current production state is honest about what is implemented and what
is still missing — see [Production status](#production-status) and
[docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md).

---

## End-to-end workflow

- **DISCOVER** — Find relevant backlink opportunities using the configured
  discovery source (seeded catalog in demo mode; real web search in
  `DISCOVERY_MODE=real`).
- **QUALIFY** — Analyze relevance, donor quality, risk, page quality,
  placement type, provider availability and other deterministic signals.
- **CREATE** — Prepare the actual placement: anchor, contextual text,
  insertion point, rationale and confidence.
- **OUTREACH** — Prepare personalized outreach messages. **Sending remains
  human-triggered.**
- **NEGOTIATE** — Analyze donor replies and prepare a negotiation strategy,
  suggested response, price range, fallback and risks. **The human approves
  and sends.**
- **PLACE** — Execute the placement where a real execution provider exists.
  Otherwise route the task through the human-in-the-loop / manual workflow.
- **VERIFY** — Verify the resulting placement using evidence. **VERIFIED must
  never mean merely "the action was attempted"** — it requires confirmed
  evidence (`SUBMITTED` is not success).

---

## Real, AI, human and demo

One of the most important things to understand about the system is what each
of these roles means:

| Role              | What happens                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **REAL**          | A real external/network operation or a real configured provider (real LLM call, real web search, real HTTP page fetch, real persistent writes). |
| **AI**            | LLM-generated analysis / recommendations / drafts (zod-validated before they can influence state).                                              |
| **DETERMINISTIC** | Domain rules, scoring, the state machine, validation, provider alignment, verification eligibility.                                             |
| **HUMAN**         | Approval, outreach sending, negotiation decisions, manual placement actions.                                                                    |
| **DEMO / MOCK**   | Synthetic/demo execution used to demonstrate the workflow (MockProvider); never a real external side effect and never presented as one.         |

**AI does not directly control business state.** The domain, the state machine
and deterministic rules remain the source of truth for:

- status transitions
- permissions
- scoring
- provider alignment
- verification eligibility
- final workflow state

AI interprets and prepares information but never silently mutates business
state (ADR-002).

---

## Link-building intelligence

Every capability is described from the product operator's perspective; the
technical implementation lives in [packages/domain](packages/domain) and
[packages/application](packages/application).

- **Donor quality / SEO intelligence** — traffic, geography, keyword profile,
  backlink profile, authority, spam risk, indexation, topical relevance,
  audience/geographic match, placement quality, automation potential. Every
  external metric carries explicit provenance (see
  [Page analysis and SEO data](#page-analysis-and-seo-data)).
- **Page-level analysis** — a donor domain and the specific placement page are
  separate entities (title, page type, topical relevance, link-insert
  suitability, indexation, outbound-link signals, suggested placement).
- **Placement types** — `LINK_INSERT`, `GUEST_POST`, `RESOURCE_PAGE`,
  `PARTNER_PAGE` plus the classic profile/listing results, each with a
  recommended workflow.
- **Link insert assistant** — web-page-aware anchor + alternatives + insertion
  point + contextual text + naturalness explanation + confidence.
- **Anchor strategy** — explicit anchor classification (exact/partial match,
  branded, generic, url, long-tail) with rationale; profile-aware when a
  campaign anchor profile exists.
- **Donor risk / spam analysis** — deterministic LOW/MEDIUM/HIGH signals.
- **Opportunity Score 2.0** — separates relevance / donor quality / placement
  quality / execution / risk into a transparent overall score (weights in
  [SCORING.md](SCORING.md)).
- **Opportunity filtering / sorting** — server-side filters (category, method,
  status, source, placement type, risk, min score, min donor quality, min
  traffic) and sorting (score / donor quality / traffic / relevance / lowest
  risk / ease).
- **Donor comparison** — side-by-side rows plus a deterministic "Почему AI
  рекомендует №1" explanation.
- **Links / anchor profile** — campaign links view and anchor profile overview,
  plus a dashboard health overview funnel.
- **Outreach assistant (HITL)** — subject, message, short version, opening,
  value proposition, placement request, CTA. Sending is only ever
  human-triggered.
- **Negotiation copilot (HITL)** — paste a donor reply → AI classifies the
  intent and prepares a suggested response, strategy, price range, fallback
  and risks; the human approves and sends.
- **Human-in-the-loop workspace** — «Требует действия» cards with WHY the
  human is needed / WHAT the AI prepared / WHAT the human must do, plus a
  primary action.
- **AI placement plan** («План размещений») — see below.

## AI placement plan

The placement plan is a portfolio-level decision layer (ADR-013): one batched
AI call interprets the deterministic signals (score, donor quality, risk,
provider availability, method) into per-opportunity suggestions:

- `RECOMMENDED` — with a next action and automation mode;
- `REVIEW_REQUIRED` — with what to review;
- `NOT_RECOMMENDED` — with a reason.

The AI output is only a _proposal_. The domain **re-reconciles** the stored
decision map against current state on every read (`reconcilePlanDecision`), so
the final bucket/action/automation is always deterministic — the AI can never
promote a low-scoring opportunity or bypass the state machine.

## Page analysis and SEO data

Provenance matters. Every external metric is classified with one of:

| Status         | Meaning                                                   |
| -------------- | --------------------------------------------------------- |
| `MEASURED`     | measured by a real external tool or real HTTP probe       |
| `AI_ESTIMATED` | estimated by AI from available context, with a confidence |
| `INTERNAL`     | derived deterministically inside the system               |
| `SYNTHETIC`    | demo/mock data — never a real measurement                 |
| `UNKNOWN`      | not available — never fabricated                          |

The rules:

- Real HTTP page analysis (`HttpPageAnalysisProvider`) measures only what it
  can (title, canonical, page type, indexation, outbound-link signals are
  `MEASURED`); everything else stays `UNKNOWN`.
- Traffic, backlinks, DR/DA-style authority and similar SEO metrics are NOT
  real **unless** a real SEO-metrics provider is configured (none is shipped;
  see [Production status](#production-status)). Without one they degrade
  honestly to `UNKNOWN` — never to invented numbers.
- `SYNTHETIC` and `AI_ESTIMATED` are clearly labeled in the UI
  («демо-данные» / «оценка AI») and must never be presented as real external
  SEO data. **`UNKNOWN` is preferable to fabricated data.**

## Placement execution

`PlacementProvider` is the abstraction every platform integration implements.
Provider alignment is deterministic: verified providers supporting
`CREATE`+`VERIFY` are selected by type priority (`API > MOCK > BROWSER >
MANUAL`), and unverified capabilities are never claimed.

**The execution engine is designed to support real placement providers, but
only providers actually implemented and configured can perform real external
placement.** Today:

- `MockProvider` exists for **demo/test execution** (deterministic simulator,
  synthetic ids and `https://mock.example/...` URLs).
- **No real placement provider is implemented** — so no real external
  publication occurs. The only way to reach `PUBLISHED` today is the manual
  (human-in-the-loop) flow with proof, or a demo mock placement.
- Real integrations for Yandex Business, 2GIS, editorial media, etc. must be
  implemented and verified behind the same contract before any real placement
  is possible.

## Demo vs Production

MockProvider is legitimate for demo/test scenarios; it must never leak into
production execution:

- **Demo/test composition may enable MOCK providers** (`MOCK_PROVIDERS=allow`):
  used by `pnpm demo`, unit fixtures and the E2E suite to demonstrate the
  complete placement lifecycle without external side effects.
- **Production composition must exclude MOCK providers** (`MOCK_PROVIDERS` is
  `deny` by default, ADR-015): the provider registry excludes MOCK records
  from listing and resolution (`ProviderUnavailableError`), so automated
  placement execution against a synthetic provider is **impossible** in
  production. An unrecognized value is a startup error.
- **Production must never execute a MOCK provider**, and a synthetic/mock
  placement must never be presented as a real backlink.
- The domain still supports `MOCK` as a legitimate provider type, because
  demo/test workflows require it; the demo-vs-production policy lives at the
  composition/registry boundary, not in the domain.
- UI provenance labels (provider label, «демо-провайдер», «Веб-поиск» source,
  «измерено»/«оценка AI»/«демо-данные»/«нет данных» metric badges) keep
  demo/synthetic data distinguishable from real data.

This policy is **implemented in the current code** (see
[docs/PRODUCTION_ARCHITECTURE.md](docs/PRODUCTION_ARCHITECTURE.md) and
ADR-015) — it is not a future plan.

## Production status

### Already real / implemented

- **Real LLM integration** — `OpenCodeAIProvider` via `AI_MODE=real`
  (OpenCode Go, OpenAI-compatible), schema-validated output, retries and
  timeouts.
- **Real HTTP page analysis** — `HttpPageAnalysisProvider` (MEASURED where
  measurable, UNKNOWN otherwise).
- **Real web discovery — two backends** — DuckDuckGo
  (`DISCOVERY_PROVIDER=duckduckgo`, default, no key) and a search-capable AI
  provider (`DISCOVERY_PROVIDER=ai-search`, needs `AI_SEARCH_*` credentials).
  Found sites are real external URLs, persisted into the platform catalog.
- **PostgreSQL (Neon) persistence** — Prisma-backed repositories behind the
  shared environment contract (ADR-014).
- **Persisted discovery state** — every discovery run is stored per campaign
  (`DiscoveryRun`: RUNNING → COMPLETED_WITH_RESULTS / COMPLETED_EMPTY / FAILED
  plus metadata) and served at `GET /api/discovery-state`; the UI uses the
  backend as the source of truth instead of sessionStorage, so "search ran but
  found nothing" survives a refresh.
- **Deterministic scoring, state machine, validation** — the domain core.
- **Human-in-the-loop workflow** — approval, outreach sending, negotiation
  approval, manual placements.
- **Evidence-based verification** — `VERIFIED` requires evidence
  (`SUBMITTED` is not success).
- **Production composition** — Vercel serverless + `pnpm start` run
  `createPrismaEnvironment` (fail-fast, no silent fallback in production).
- **MOCK-provider exclusion in production** — implemented (ADR-015).

### Demo / synthetic

- `MockPlacementProvider` — demo/test placement execution (synthetic evidence).
- Deterministic `ScenarioAIProvider` — demo AI; not a real LLM call.
- Synthetic SEO metrics (`SYNTHETIC`) and demo fixtures/data (Nordhaus).

### Still requires external integrations / credentials

- **No real placement provider** — no real external publication happens today.
- **SEO metrics provider** (Ahrefs/Semrush/Similarweb/GSC) — port exists, no
  real implementation or credentials.
- **Real outreach/email integration** — the production composition binds the
  scenario (synthetic) outreach provider; no real transport.
- **Authentication / authorization** — no user model yet (single-tenant).
- **Observability** — audit log + `/api/health` exist; structured metrics /
  alerting not built.
- **Queue / background processing** — deferred (ADR-013).

See [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) for the full,
per-item audit.

## Quick start

### Demo

```bash
pnpm demo
```

Deterministic, in-memory, no database and no network: the full Nordhaus
journey — analysis → strategy → discovery → classification → approval →
execution (incl. retry) → monitoring → manual flow → verification → AI
placement plan — runs on the MockProvider and demo fixtures.

### Local development

```bash
pnpm install
pnpm db:generate      # generate Prisma Client
pnpm db:migrate       # apply migrations (needs .env)
pnpm db:seed          # idempotent catalog + synthetic Nordhaus demo records
pnpm start            # whole product on one port (http://localhost:8787)
```

### Web / API development

```bash
pnpm dev:web          # Vite dev server (http://localhost:5173, /api proxied to :8787)
pnpm dev:api          # API dev server with watch
pnpm build:web        # production web build into apps/web/dist
```

> Commands are intentionally unchanged from the project scripts; see
> [Setup and commands](#setup-and-commands) for details.

## Real mode configuration

The default demo mode is deterministic and makes no network calls. To run real
AI and real web discovery, set the mode variables (see also
[INTEGRATIONS.md](INTEGRATIONS.md)):

```bash
AI_MODE=real DISCOVERY_MODE=real OPENCODE_API_KEY=sk-... pnpm start
```

Environment variables:

| Variable                                                                                                           | Default                         | Purpose                                                                                               |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `AI_MODE`                                                                                                          | `demo`                          | `real` uses `OpenCodeAIProvider` (real LLM) + `HttpPageAnalysisProvider` (real HTTP page analysis).   |
| `DISCOVERY_MODE`                                                                                                   | `demo`                          | `real` enables real web discovery (`WebSearchPlatformDiscoverySource`).                               |
| `DISCOVERY_PROVIDER`                                                                                               | `duckduckgo`                    | Real search backend: `duckduckgo` (HTML search, no key) or `ai-search` (search-capable AI citations). |
| `OPENCODE_API_KEY`                                                                                                 | —                               | Required by any real mode; missing is a startup error (no silent fallback).                           |
| `OPENCODE_BASE_URL`                                                                                                | `https://opencode.ai/zen/go/v1` | OpenCode Go endpoint.                                                                                 |
| `OPENCODE_MODEL`                                                                                                   | `deepseek-v4-pro`               | Chat-completions model.                                                                               |
| `OPENCODE_TIMEOUT_MS`                                                                                              | `30000`                         | Per-request AI timeout.                                                                               |
| `AI_SEARCH_API_KEY` / `AI_SEARCH_BASE_URL` / `AI_SEARCH_MODEL` / `AI_SEARCH_CAPABILITIES` / `AI_SEARCH_TIMEOUT_MS` | —                               | `DISCOVERY_PROVIDER=ai-search` credentials & declared capabilities (e.g. `web_search,citations`).     |
| `MOCK_PROVIDERS`                                                                                                   | `deny`                          | `allow` binds MOCK placement providers — **demo/test/preview only**, never production.                |
| `DISCOVERY_MAX_QUERIES`, `DISCOVERY_MAX_RESULTS_PER_QUERY`, `DISCOVERY_MAX_CANDIDATES`, `DISCOVERY_CONCURRENCY`    | bounded defaults                | Cost/latency caps for real web discovery.                                                             |

Important behaviors:

- **`AI_MODE=real`** — every AI capability runs on the configured model; page
  analysis is real HTTP; without a paid SEO-metrics source all SEO metrics
  stay honestly `UNKNOWN` («нет данных» in the UI).
- **`DISCOVERY_MODE=real`** — the «Найти площадки» action plans search intents
  via AI and searches real sites through the configured provider; found sites
  are persisted into the platform catalog and labeled `web-search`.
- Real modes without `OPENCODE_API_KEY` (or `AI_SEARCH_API_KEY` for
  `DISCOVERY_PROVIDER=ai-search`) **fail fast at startup** — the product never
  silently falls back to demo data.
- Provider failures are loud (`DiscoverySearchFailedError`, HTTP 502); real
  data is never replaced with fake results.
- UI provenance is explicit: `OpenCode Go` provider label, `Веб-поиск` source
  chip, `измерено` / `оценка AI` / `демо-данные` / `нет данных` metric badges.

> Note: `DISCOVERY_PROVIDER` / `AI_SEARCH_*` are documented in `.env.example`
> with placeholders. Never put real credentials in this repository — use
> environment variables (Vercel project env vars) instead.

## Repository architecture

```text
apps/
  api/             delivery layer: Hono routes + request validation + error mapping
                   + composition roots (Prisma production env, Nordhaus demo env)
  web/             Russian UI: Vite + React + React Router; typed API client; labels only
packages/
  domain/          pure business logic: entities, enums, state machine, capabilities,
                   scoring, alignment, strategy, validation — depends on nothing
  application/     ports + use cases + command DTOs + application errors
  infrastructure/  Prisma schema + migrations + Prisma/in-memory repositories + seed
  ai/              AI provider abstraction + OpenAI-compatible client + zod output schemas
  integrations/    provider contracts (placement / web-search / ai-search) + MockProvider
tests/
  unit/            unit tests (no database), incl. delivery-layer tests
  integration/     database tests (need DATABASE_URL)
  e2e/             full Nordhaus E2E over HTTP
docs/decisions/    ADRs
```

Dependency direction:

```text
apps (Presentation/Delivery) → Application → Domain ← Infrastructure
```

`Domain` depends on nothing. `Application` depends only on ports/interfaces.
`Infrastructure` and `integrations` implement those contracts. `apps/web` is a
thin presentation layer — every value (status, allowed actions, ranking)
comes from the API, and no state transition runs outside the application use
cases and the domain state machine. `ai` is an intelligence provider, not the
controller of business state.

## Database

The project uses **Neon PostgreSQL**. There is no local PostgreSQL requirement.

1. Copy `.env.example` to `.env` and fill in the two variables from the Neon
   dashboard (Connect → Prisma):
   - `DATABASE_URL` — pooled connection (pgbouncer transaction mode), runtime.
   - `DIRECT_URL` — direct (unpooled) connection, used by Prisma Migrate.
2. Do not commit `.env` (it is gitignored).

Local dev network note: on some networks the Neon direct endpoint is
unreachable while the pooled endpoint works; if `prisma migrate dev` fails
with `P1001`, point `DIRECT_URL` at the pooled endpoint for local work (see
ADR-008). On Vercel/CI use the native direct endpoint.

The Prisma migrations (`init`, `link_building_intel`, `placement_plan`) must
be applied when the database is reachable; on Vercel this happens automatically
— the build command runs `npx prisma migrate deploy`. `pnpm db:seed` is
idempotent and loads the catalog (8 categories, 20 platforms, 13 provider
records, the Nordhaus demo company + campaign, all labeled synthetic).

## Setup and commands

```bash
pnpm install
pnpm db:generate      # generate Prisma Client
pnpm db:migrate       # apply migrations (needs .env)
pnpm db:seed          # idempotent seed: catalog + synthetic Nordhaus demo records
pnpm demo             # deterministic end-to-end demo (in-memory, no DB)
pnpm start            # run the whole product on one port (http://localhost:8787):
                      # API + built web UI (apps/web/dist). Production:
                      # Prisma-backed over PostgreSQL (Neon) — data persists.
                      # Outside NODE_ENV=production with an unreachable database it
                      # falls back to the in-memory Nordhaus demo with an explicit
                      # warning (no persistence).
pnpm dev:web          # Vite dev server (http://localhost:5173, /api proxied to :8787)
pnpm dev:api          # API dev server with watch
pnpm build:web        # production web build into apps/web/dist
```

In production (Vercel serverless, or `NODE_ENV=production`) the app is
persistence-first: it fails fast when PostgreSQL is unreachable and never
silently falls back to in-memory data (ADR-014). `pnpm db:seed` must have been
run once so the platform catalog exists — users then create companies and
campaigns via the UI, and they survive cold starts and multiple serverless
instances.

## Testing and quality gates

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

Overview: [TESTING.md](TESTING.md).

## Production / Vercel

Vercel hosting (project `aioslinkbuilder`), Neon PostgreSQL, access
provider-agnostic (only `DATABASE_URL` / `DIRECT_URL` env vars are required by
the application). Deployment notes:

- `packageManager` pins `pnpm@11.9.0` (`allowBuilds`/`patchedDependencies` are
  pnpm 11 features).
- The Vercel build runs `npx prisma migrate deploy` and then
  `pnpm build:vercel` (`build:web` + `build:vercel:api`); `vercel.json` serves
  `apps/web/dist` and rewrites non-API routes to `/index.html` (SPA fallback)
  and `/api/(.*)` to `/api/index`.
- The API function is `scripts/vercel-entry.ts` bundled to `api/index.mjs`
  (esbuild, committed): the bundle is required because Vercel leaves workspace
  dependencies external and their package exports point at TypeScript sources.
  Compose `createPrismaEnvironment` once per warm instance; `@prisma/client`
  stays external so the generated client and query engine resolve from
  `node_modules` at runtime (same proven path as `api/health.mjs`, ADR-014).
- `api/health.mjs` reports DB reachability (stage-by-stage raw probe) and
  Prisma initialization.
- `prisma@6.19.3` is published with a broken `exports` map; it is patched via
  pnpm `patchedDependencies` (`patches/prisma@6.19.3.patch`), and the `prisma`
  CLI is a devDependency of `packages/infrastructure`.
- Production env: `AI_MODE`/`DISCOVERY_MODE`/`DISCOVERY_PROVIDER`,
  `OPENCODE_*`/`AI_SEARCH_*`, and `MOCK_PROVIDERS` (leave unset or `deny`,
  never `allow`).

## Phase status

For the implementation history (not product capability order):

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
| 8     | AI placement plan: batched AI decision map + deterministic re-reconciliation + API + UI + tests + docs                           | done   |
| 9     | real AI + web discovery modes, Vercel persistence, MOCK-provider production policy                                               | done   |

## Key decisions

See [docs/decisions/](docs/decisions/) for the full ADRs. Highlights:

- Modular monolith (ADR-001); AI is an intelligence provider, not a controller
  (ADR-002); provider-based integrations (ADR-003); human approval before
  external actions (ADR-004); PostgreSQL as single source of truth (ADR-005).
- Platform and PlacementProvider are separate entities (ADR-006); state
  machine implements only documented transitions (ADR-007); tooling:
  pnpm workspaces, strict TS, Vitest, Prisma, zod (ADR-008); application
  layer: ports + use cases + command DTOs, delivery deferred (ADR-009).
- Discovery is a port (ADR-010); link-building intelligence lives as typed
  JSON on the opportunity with new provider ports and zod-validated AI methods
  (ADR-011).
- Real AI + web discovery are opt-in via env vars, never silent (ADR-012); the
  AI placement plan is a read-side decision layer, AI never writes business
  state (ADR-013); production runs Prisma over PostgreSQL/Neon behind a shared
  environment contract (ADR-014); MOCK providers are excluded from production
  by explicit opt-in (`MOCK_PROVIDERS=deny` default, ADR-015).
- Failed attempts are retried with a fresh Placement record; manual placements
  go through `NEEDS_MANUAL` and reach `PUBLISHED` only with proof
  (human-in-the-loop path).

## Deployment

For exact deployment commands and infrastructure steps, follow
[docs/PRODUCTION_ROADMAP.md](docs/PRODUCTION_ROADMAP.md) and
[docs/PRODUCTION_ARCHITECTURE.md](docs/PRODUCTION_ARCHITECTURE.md). The core
steps are: configure Vercel env vars, run a build (applies migrations), seed
the catalog once, and verify `GET /api/health`.

## Further documentation

Product / domain:

- [PRD.md](PRD.md)
- [DOMAIN_MODEL.md](DOMAIN_MODEL.md)
- [STATE_MACHINE.md](STATE_MACHINE.md)
- [SCORING.md](SCORING.md)
- [LIMITATIONS.md](LIMITATIONS.md)

Architecture:

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [INTEGRATIONS.md](INTEGRATIONS.md)
- [AI_WORKFLOWS.md](AI_WORKFLOWS.md)
- [docs/decisions/](docs/decisions/) — ADRs

Operations:

- [docs/LINK_BUILDING_OPERATIONS.md](docs/LINK_BUILDING_OPERATIONS.md)
- [docs/DEMO.md](docs/DEMO.md)
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)

Production:

- [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md)
- [docs/PRODUCTION_ARCHITECTURE.md](docs/PRODUCTION_ARCHITECTURE.md)
- [docs/PRODUCTION_ROADMAP.md](docs/PRODUCTION_ROADMAP.md)

Testing:

- [TESTING.md](TESTING.md)
