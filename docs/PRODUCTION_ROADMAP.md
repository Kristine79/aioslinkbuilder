# Production Roadmap

The module is architecturally production-ready (strict types, deterministic core,
tested AI boundary); the path to live production is about integrations, ops and
scale. Priorities follow `docs/PRODUCTION_READINESS.md`.

## Phase A — Ship current scope (blocked only by one command)

1. Apply migrations to Neon: `npx prisma migrate deploy` from CI/Vercel or a
   reachable network (ADR-008; `20260818120000_link_building_intel` +
   `20260819120000_placement_plan`). Verify `GET /api/health` shows `prisma: ok`.
2. Configure Vercel env vars (`DATABASE_URL`, `DIRECT_URL`, `OPENCODE_API_KEY`,
   mode flags; `MOCK_PROVIDERS` — leave unset or set `deny`, never `allow`);
   verify production boots in demo mode. MOCK provider exclusion is already
   enforced by default (ADR-015, P0#3 in PRODUCTION_READINESS.md).
3. CI pipeline: typecheck + lint + format:check + unit + E2E on every push; add
   integration tests on the CI network (where Neon is reachable).

## Phase B — First real integration (de-risk the provider abstraction)

4. Implement one real platform adapter end-to-end (Yandex Business API or 2GIS API):
   discover → classify → approve → execute → monitor → verify with `MEASURED`
   evidence. Document the verified capability first (INTEGRATIONS.md policy).
5. Real AI smoke run: `AI_MODE=real` with `AnalyzeCompany` and
   `POST /api/placement-plan`; confirm zod validation and error mapping in logs.

## Phase C — Product hardening

6. AuthN/AuthZ + multi-tenant campaign isolation (no user model exists yet — P0 for
   multi-user SaaS; not needed for single-tenant internal use).
7. Paid SEO metrics (Ahrefs/Semrush/Similarweb) behind `SeoMetricsProvider`; enrich
   plan inputs with real donor data (`MEASURED`).
8. Background queue for plan generation and monitoring polls if
   portfolios/timeouts demand it (explicitly deferred in ADR-013).
9. Per-company anchor profile (currently `profileAvailable: false`), rejection
   recovery for BLOCKED/REJECTED (STATE_MACHINE.md), and full OpenAI/Anthropic
   provider support behind the existing AI abstraction.

## Phase D — Scale and observability

10. Structured metrics (generation latency, AI success rates, plan
    automation %, verification pass rate), alerting, and error tracking.
11. Load testing of the reconciliation path (pure CPU, cheap) and the batched AI
    call under large opportunity sets.

## Non-goals (until explicitly requested)

- Real autonomous execution without human approval (ADR-004 stands).
- Email capture / billing / SaaS onboarding.
- Replacing the deterministic reconciliation with free-form AI decisions (ADR-013).
