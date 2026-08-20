# Production Readiness Audit

Audit performed 2026-08-19 (updated to reflect current code). Status per item
uses an explicit classification:

- **IMPLEMENTED** — present in the current code and exercised by the automated
  suite (unit/integration/E2E).
- **VERIFIED** — IMPLEMENTED _and_ confirmed against a real external system or
  on the deployed environment (only where this is actually true).
- **PARTIALLY IMPLEMENTED** — mechanism exists, but an important part is still
  missing (see the note).
- **NOT IMPLEMENTED** — port/plan only, no working implementation.
- **BLOCKED** — blocked by an environment/network condition outside the code.
- **REQUIRES EXTERNAL CREDENTIALS** — works in code, but needs paid/external
  credentials to operate in production.

## Executive summary

Two different questions must be kept apart:

1. **Is the architecture production-grade?** Yes for the core: strict
   TypeScript, a deterministic domain layer with a tested state machine,
   schema-validated AI boundary, provider abstraction with a MOCK
   exclusion policy at the composition boundary, evidence-based
   verification, immutable audit log, and Prisma-backed persistence
   behind a shared environment contract.
2. **Is the product production-ready today?** No — not yet. Critical
   external integrations are still missing or credential-scoped, and the
   database migration must actually run on Neon via a deployment. Today the
   product is a **working prototype-to-early-production system**: it
   persists real data, runs real AI and real web discovery when configured,
   and performs real HTTP page analysis — but it has **no real placement
   provider**, so no real external backlink/publication happens.

The core logic is covered by **348 unit tests** (33 files), 13 E2E tests and 6
integration tests (DB-gated).

## Capability matrix

| Capability                                            | Status                                              | Notes                                                                                                                                                                        |
| ----------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain/application logic, state machine, scoring      | **IMPLEMENTED**                                     | deterministic, tested, no `any`, strict TS                                                                                                                                   |
| AI boundary (schema-validated output, reconciliation) | **IMPLEMENTED**                                     | real provider in `AI_MODE=real`; demo provider deterministic; zod validation                                                                                                 |
| Real AI (OpenCode Go)                                 | **IMPLEMENTED** (REQUIRES EXTERNAL CREDENTIALS)     | `OpenCodeAIProvider`, fail-fast without `OPENCODE_API_KEY`; unit-tested with fakes                                                                                           |
| Placement plan (decision engine + reconciliation)     | **IMPLEMENTED**                                     | same robustness as the rest of the AI boundary (ADR-013)                                                                                                                     |
| Web UI / API delivery                                 | **IMPLEMENTED**                                     | static bundle + serverless API, SPA fallback, error mapping                                                                                                                  |
| Vercel deployment                                     | **PARTIALLY IMPLEMENTED**                           | `vercel.json` + committed `api/index.mjs` bundle + `/api/health`; requires a real deploy                                                                                     |
| Neon persistence                                      | **PARTIALLY IMPLEMENTED**                           | schema + migrations exist; **applied to Neon only via a successful deployment** (Vercel build runs `prisma migrate deploy`; local network cannot reach Neon)                 |
| Discovery state persistence (`/api/discovery-state`)  | **IMPLEMENTED**                                     | per-campaign `DiscoveryRun` (RUNNING → WITH_RESULTS/EMPTY/FAILED); the UI uses the backend as the source of truth instead of sessionStorage                                  |
| Real web discovery (DuckDuckGo)                       | **IMPLEMENTED**                                     | `DISCOVERY_MODE=real` + `DISCOVERY_PROVIDER=duckduckgo`; unit-tested                                                                                                         |
| Real web discovery (AI-search citations)              | **IMPLEMENTED** (REQUIRES EXTERNAL CREDENTIALS)     | `DISCOVERY_PROVIDER=ai-search`; needs `AI_SEARCH_API_KEY` + `AI_SEARCH_CAPABILITIES`                                                                                         |
| Real page analysis (HTTP)                             | **IMPLEMENTED**                                     | `HttpPageAnalysisProvider` (MEASURED where measurable, UNKNOWN otherwise)                                                                                                    |
| Real SEO metrics (Ahrefs/Semrush/Similarweb/GSC)      | **NOT IMPLEMENTED** (REQUIRES EXTERNAL CREDENTIALS) | port exists (`SeoMetricsProvider`); no real implementation, no paid credentials                                                                                              |
| Real outreach/email integration                       | **NOT IMPLEMENTED**                                 | port exists; production binds the scenario (synthetic) implementation                                                                                                        |
| MockProvider execution/monitoring/verification        | **IMPLEMENTED (demo/test only)**                    | demo-grade by design; excluded from the production composition (ADR-015)                                                                                                     |
| Real platform execution (Yandex Business, 2GIS, ...)  | **NOT IMPLEMENTED**                                 | interface-only; no real platform adapter shipped; a platform in the dataset does not imply automated publication                                                             |
| Verification + evidence                               | **PARTIALLY IMPLEMENTED**                           | flow IMPLEMENTED and tested; VERIFIED is only reachable via mock evidence (demo) or human-provided manual proof — a real provider must exist to verify real external results |
| Authentication / authorization / multi-tenancy        | **NOT IMPLEMENTED**                                 | no user model; single-tenant only                                                                                                                                            |
| Observability (metrics/alerting/error tracking)       | **NOT IMPLEMENTED**                                 | audit log + `/api/health` exist; structured metrics, alerting, tracing are not built                                                                                         |
| Queue / background jobs / billing                     | **NOT IMPLEMENTED**                                 | explicitly out of scope (ADR-013)                                                                                                                                            |

## Required before production launch (P0)

1. **Apply Prisma migrations to Neon (MECHANISM IMPLEMENTED, RUN AT DEPLOY).**
   The Vercel build command now runs
   `npx prisma migrate deploy --schema packages/infrastructure/prisma/schema.prisma`,
   so the migrations (`init`, `20260818120000_link_building_intel`,
   `20260819120000_placement_plan`, `20260819180000_add_discovery_run`) are
   applied automatically on a build when
   `DATABASE_URL`/`DIRECT_URL` are configured. Local network still cannot
   reach Neon (ADR-008), so the apply must be confirmed on a real deployment:
   `GET /api/health` should report `prisma: ok` and the enums must be present.
2. **Secrets hygiene (REQUIRED, blocking to verify).** `DATABASE_URL`/
   `DIRECT_URL`/`OPENCODE_API_KEY` (and `AI_SEARCH_*` if used) must exist in
   the Vercel project env vars; `.env` stays gitignored; the key is never sent
   to the client (server-only, verified by tests: 401 → no retry, no key
   leakage).
3. **MOCK providers are excluded in production (IMPLEMENTED — ADR-015).**
   `MOCK_PROVIDERS` defaults to `deny` in the production composition; the
   registry excludes MOCK records from listing and resolution
   (`ProviderUnavailableError`), so provider selection can never yield a MOCK
   record and automated execution against synthetic providers is impossible in
   production. Covered by runtime-config tests, the composition policy test
   suite and the Neon-gated integration test
   (`tests/integration/production-composition.test.ts`). Verify at deploy time
   that `MOCK_PROVIDERS` is unset or `deny` (never `allow`).

## Recommended before production launch (P1)

4. **One real provider adapter** (e.g. Yandex Business API or 2GIS API)
   end-to-end with `MEASURED` verification — proves the provider abstraction in
   production and de-risks the MockProvider-only path. Until this exists, no
   real external placement occurs.
5. **CI pipeline** — typecheck + lint + format:check + unit + E2E on every
   push (currently developer-run, all green locally).
6. **Real AI smoke test** — one `AnalyzeCompany` + one
   `GeneratePlacementPlan` call with `AI_MODE=real` on the target model,
   schema validation in prod logs.
7. **Rate limits / queue** — batched plan generation and discovery are
   synchronous; a long-running call may exceed the serverless 300s limit on
   very large portfolios. Defer to a queue only when a real workload demands
   it (ADR-013).

## Known limitations (documented, not blockers)

- Integration tests fail locally because Neon is unreachable from the dev
  network (pre-existing; `/api/health` reports `prisma: ok` only from the
  Vercel network).
- Real-mode SEO metrics degrade honestly to `UNKNOWN` without paid credentials.
- DuckDuckGo HTML discovery is a real but prototype-grade search backend (it
  scrapes a consumer search page, not an official API); the `ai-search`
  backend is the credential-scoped alternative.
- Demo/synthetic data is always labeled (`SYNTHETIC`) and never presented as
  real; a synthetic placement never represents a real external publication.
