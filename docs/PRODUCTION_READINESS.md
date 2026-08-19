# Production Readiness Audit

Audit performed 2026-08-19. Status per capability: **Ready** / **Partial** / **Not Ready**.

## Executive summary

The module is a **working prototype-to-early-production product**: the domain and
application logic, state machine, deterministic scoring, AI boundary and the web
delivery are production-grade in architecture and are covered by 244 unit tests and
a full E2E flow. The gaps to "production" are **external integrations** (real
platform providers, paid SEO metrics) and **database migration application**, not
core logic.

## Capability matrix

| Capability                                            | Status        | Notes                                                                        |
| ----------------------------------------------------- | ------------- | ---------------------------------------------------------------------------- |
| Domain/application logic, state machine, scoring      | **Ready**     | deterministic, tested, no `any`, strict TS                                   |
| AI boundary (schema-validated output, reconciliation) | **Ready**     | real AI provider supported (`AI_MODE=real`), demo provider deterministic     |
| Placement plan (decision engine + reconciliation)     | **Ready**     | same robustness as the rest of the AI boundary                               |
| Web UI / API delivery                                 | **Ready**     | static bundle + serverless API, SPA fallback, error mapping                  |
| Vercel deployment                                     | **Ready**     | `vercel.json` + committed `api/index.mjs` bundle + `/api/health`             |
| Neon persistence                                      | **Partial**   | schema + migrations exist; **not yet applied** to Neon (see below)           |
| MockProvider execution/monitoring/verification        | **Partial**   | demo-grade by design; no real platform adapter shipped                       |
| Real platform execution (Yandex Business, 2GIS, ...)  | **Not Ready** | interface-only; each requires verified capability docs before implementation |
| Real SEO metrics (Ahrefs/Semrush/Similarweb/GSC)      | **Not Ready** | port exists (`SeoMetricsProvider`); needs paid credentials                   |
| Real web discovery (DuckDuckGo)                       | **Ready**     | `DISCOVERY_MODE=real` implemented and unit-tested                            |
| Email/queue/background jobs/billing                   | **Not Ready** | explicitly out of scope (ADR-013)                                            |

## Required before production launch (P0)

1. **Apply Prisma migrations to Neon** — `20260818120000_link_building_intel` and
   `20260819120000_placement_plan` (`AIAnalysisType` gained `PAGE_ANALYSIS`/... and
   `PLACEMENT_PLAN`). Local network cannot reach Neon (see ADR-008): run
   `prisma migrate deploy` from CI/Vercel or a reachable network. Without this, the
   `PLACEMENT_PLAN` AIAnalysis row cannot be stored in the real DB (in-memory demo is
   unaffected).
2. **Secrets hygiene** — `DATABASE_URL`/`DIRECT_URL`/`OPENCODE_API_KEY` must exist in
   Vercel project env vars; `.env` stays gitignored; key is never sent to the client
   (server-only, verified by tests: 401 → no retry, no key leakage).
3. **Production composition must pass `allowMocks: false`** — MOCK provider records
   can never be selected in production (registry excludes them). Verify in the
   Vercel/CI environment that provider selection never yields a MOCK record.

## Recommended before production launch (P1)

4. **One real provider adapter** (e.g. Yandex Business API or 2GIS API) end-to-end
   with `MEASURED` verification — proves the provider abstraction in production and
   de-risks the MockProvider-only path.
5. **CI pipeline** — typecheck + lint + format:check + unit + E2E on every push
   (currently developer-run, all green locally).
6. **Real AI smoke test** — one `AnalyzeCompany` + one `generatePlacementPlan` call
   with `AI_MODE=real` on the target model, schema validation in prod logs.
7. **Rate limits / queue** — batched plan generation is synchronous; a long-running
   AI call may exceed the serverless 300s limit on very large portfolios. Defer to
   the queue only when a real workload demands it (ADR-013).

## Known limitations (documented, not blockers)

- Integration tests fail locally because Neon is unreachable from the dev network
  (pre-existing; `/api/health` reports `prisma: ok` from the Vercel network).
- Real-mode SEO metrics degrade honestly to `UNKNOWN` without paid credentials.
- Demo/synthetic data is always labeled (`SYNTHETIC`) and never presented as real.
