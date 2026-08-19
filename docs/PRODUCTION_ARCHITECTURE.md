# Production Architecture

How the module is deployed and how the pieces work together in production.
Detailed component design: `ARCHITECTURE.md`; ops flow: `docs/LINK_BUILDING_OPERATIONS.md`.

## Deployment topology

```text
Vercel
  ├── static: apps/web/dist (React SPA, Russian UI)
  │     └── rewrites: non-API → /index.html (SPA fallback)
  ├── serverless function: api/index.mjs (Hono app, single instance per warm run)
  │     └── routes /api/* → /api/index via vercel.json rewrite
  ├── serverless function: api/health.mjs (DB + Prisma probe)
  └── env: DATABASE_URL, DIRECT_URL (Neon), AI_MODE/DISCOVERY_MODE/OPENCODE_*
Neon PostgreSQL (managed, pooled + direct endpoints)
```

Single-port local mode (`pnpm start`, :8787) serves the same app: API +
built web UI with SPA fallback — the Vercel function is the same `createApiApp` +
`runNordhausBootstrap` composition.

## Runtime composition

- `scripts/vercel-entry.ts` (bundled to `api/index.mjs` by esbuild) builds the
  production composition: real repositories (Prisma), provider registry with
  `allowMocks: false`, real AI provider when `AI_MODE=real` (fail-fast without a key),
  real web-search discovery when `DISCOVERY_MODE=real`.
- The bootstrap reproduces the Nordhaus mid-flight scenario **only for the demo
  composition**; production boots from the empty database.
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
- `AIAnalysisType` enum extended by manual migrations
  (`20260818120000_link_building_intel`, `20260819120000_placement_plan`); they must
  be applied with `prisma migrate deploy` in production (see PRODUCTION_READINESS.md P0-1).
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
