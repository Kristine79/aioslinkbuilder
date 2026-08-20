# Production Architecture

How the module is deployed and how the pieces work together in production.
Detailed component design: `ARCHITECTURE.md`; ops flow: `docs/LINK_BUILDING_OPERATIONS.md`.
This document describes the **intended production architecture implemented by
the current code**. Where a capability is only planned, it says so explicitly
(see `docs/PRODUCTION_READINESS.md` for the honest state).

## Deployment topology

```text
Vercel
  ├── static: apps/web/dist (React SPA, Russian UI)
  │     └── rewrites: non-API → /index.html (SPA fallback)
  ├── serverless function: api/index.mjs (Hono app, single instance per warm run)
  │     └── routes /api/* → /api/index via vercel.json rewrite
  ├── serverless function: api/health.mjs (DB + Prisma probe)
  └── env: DATABASE_URL, DIRECT_URL (Neon), AI_MODE/DISCOVERY_MODE/DISCOVERY_PROVIDER/
          OPENCODE_*/AI_SEARCH_*, MOCK_PROVIDERS (default deny, ADR-015)
Neon PostgreSQL (managed, pooled + direct endpoints)
```

Single-port local mode (`pnpm start`, :8787) serves the same app: API +
built web UI with SPA fallback — the Vercel function is the same
`createApiApp` + `createPrismaEnvironment` composition.

## Runtime composition

- `scripts/vercel-entry.ts` (bundled to `api/index.mjs` by esbuild) and
  `apps/api/src/server.ts` (`pnpm start`) build the production composition:
  `loadRuntimeConfig()` → `createPrismaEnvironment(config)`. Real repositories
  (Prisma), real AI provider when `AI_MODE=real` (fail-fast without a key),
  real web-search discovery when `DISCOVERY_MODE=real`.
- Discovery in real mode is the `WebSearchPlatformDiscoverySource`, backed by
  `DISCOVERY_PROVIDER`: `duckduckgo` (default; DuckDuckGo HTML search) or
  `ai-search` (search-capable AI provider citations; needs `AI_SEARCH_*`
  credentials). Both return real external URLs; failures are loud, never
  replaced with fake results.
- The discovery source receives the campaign's **strategy directions**
  (catalog-backed and AI-derived alike) as search context via
  `DiscoverySourceInput.strategyDirections`, not the raw AI categories and
  not "every catalog category". Catalog categories are a
  normalization/enrichment anchor (category filtering only applies to codes
  that exist in the catalog) — a company whose analysis names topics outside
  the catalog still gets real web discovery instead of an empty result.
- MOCK placement providers are gated by `MOCK_PROVIDERS` (default `deny`):
  the registry excludes MOCK records from listing and resolution
  (`ProviderUnavailableError`), so automated execution against synthetic
  providers is impossible in production (ADR-015). Only demo/test
  compositions set `MOCK_PROVIDERS=allow`; an unknown value fails startup.
- **No real placement provider is implemented.** The provider registry binds
  no executable platform integration in production (only MANUAL records stay
  listed, with the human-in-the-loop flow). Placement therefore reaches
  `PUBLISHED` only through the manual flow with human proof. Real external
  publication requires a real adapter behind the `PlacementProvider` contract.
- The outreach provider bound by the production composition is currently the
  scenario (`ScenarioOutreachProvider`) implementation: no real
  email/messaging integration exists yet; sending is human-triggered and the
  provider returns a synthetic id even in production.
- The Nordhaus mid-flight **demo bootstrap** runs only in the demo composition
  (`pnpm demo`, `apps/api/src/scenario/`, local fallback in `server.ts`).
  The production composition boots from the database: `pnpm db:seed` loads
  the catalog (categories/platforms/providers) **and** the synthetic
  Nordhaus company + DRAFT campaign (labeled synthetic); user data is created
  via the API/UI.
- Provider selection is pure domain logic: verified providers supporting
  CREATE+VERIFY are chosen by type priority; MOCK is excluded at the registry
  boundary in production.

## Data flow (placement plan example)

```text
UI (React) → GET /api/placement-plan
  → GetPlacementPlanUseCase
      → load plan data (campaign, company analysis, categories, platforms,
        providers, opportunities, per-opportunity intel)
      → stored AIAnalysis(PLACEMENT_PLAN) exists?  → no → NoPlacementPlanError (404)
      → re-reconcile decision map against CURRENT state (domain
        reconcilePlanDecision) → PlacementPlan DTO → UI
UI → POST /api/placement-plan
  → GeneratePlacementPlanUseCase
      → one batched AI call (zod-validated decision map)
      → coverage assertion (exact discovered ids) → persist AIAnalysis
      → audit PLACEMENT_PLAN_GENERATED
```

Every write in the product goes through an application use case; the domain state
machine is the only authority for placement state; all AI output is validated before
it can influence business state.

## Persistence

- Prisma + Neon: `DATABASE_URL` (pooled, runtime) / `DIRECT_URL` (migrate).
- The Vercel build command (`vercel.json`) runs
  `npx prisma migrate deploy` on every build, so migrations
  (`20260817134622_init`, `20260818120000_link_building_intel`,
  `20260819120000_placement_plan`, `20260819180000_add_discovery_run`) are
  applied to Neon at deploy time
  (see PRODUCTION_READINESS.md P0-1 — application is implemented; verify on a
  real deployment).
- Discovery run state is persisted per campaign (`DiscoveryRun` table) and
  served at `GET /api/discovery-state`; the UI reads it instead of
  sessionStorage, so "search ran but found nothing" survives a refresh.
- Business logic never depends on DB-specific behavior (no triggers; the state
  machine is application-enforced — the DB is a dumb store of records).

## Observability / health

- `GET /api/health` (`api/health.mjs`) — stage-by-stage probe: products reachable,
  Neon TCP reachable, Prisma connect OK, and Prisma initialization state.
- Audit journal (`GET /api/activity`) rebuilds the full operational history
  (actor system/human, entity, action, metadata) — the primary audit trail.

## Security posture

- Secrets server-side only (env vars, never committed, never in frontend bundles).
- Request validation at the API boundary (Hono + zod-validated DTOs).
- No user authentication/authorization has been implemented yet — multi-tenant
  isolation and authN/authZ are required before real-world multi-user usage.

## Performance notes

- Plan generation is a single batched AI call; reads are deterministic
  re-reconciliation (no AI call).
- The serverless limit (300s) bounds very large synchronous AI calls; a queue is
  deferred (ADR-013) until a real workload demands it.
- Real web discovery is latency-bounded by configurable limits
  (`DISCOVERY_MAX_QUERIES`, `DISCOVERY_MAX_RESULTS_PER_QUERY`,
  `DISCOVERY_MAX_CANDIDATES`, `DISCOVERY_CONCURRENCY`).
