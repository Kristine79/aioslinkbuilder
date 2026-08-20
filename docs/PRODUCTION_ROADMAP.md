# Production Roadmap

The path to live production. Priorities follow `docs/PRODUCTION_READINESS.md`.
This document separates:

- **already implemented architecture / mechanics**,
- **integrations ready behind interfaces** (implemented but not yet wrong
  credentials or a real deployment),
- **integrations that still require development** (port-only today),
- **production hardening still required** (auth, CI, observability).

Do not treat an interface as a finished integration: a port exists does not
mean the real provider is built.

## Already implemented (mechanics / architecture)

1. **Production composition (Prisma-backed)**: Vercel function and `pnpm start`
   build `createPrismaEnvironment` (ADR-014) — PostgreSQL (Neon) persistence,
   fail-fast when the DB or catalog is missing; no silent fallback in
   `NODE_ENV=production`.
2. **MOCK-provider production policy (implemented — ADR-015)**: `MOCK_PROVIDERS`
   defaults to `deny`; the registry excludes MOCK records, so automated
   placement execution against synthetic providers is impossible in
   production. Only demo/test/preview set `allow`. This is a real (done) gate —
   the phase here is _verify at deploy time_, not implement.
3. **Real AI (implemented, needs a key at deploy)**: `OpenCodeAIProvider`
   behind `AI_MODE=real`; real HTTP page analysis; real-mode metrics degrade
   to `UNKNOWN` (no fake data).
4. **Real web discovery (implemented)**: `WebSearchPlatformDiscoverySource`
   with `DISCOVERY_PROVIDER=duckduckgo` (no key) and
   `DISCOVERY_PROVIDER=ai-search` (needs `AI_SEARCH_*` credentials).
5. **Vercel deployment mechanics**: committed `api/index.mjs` bundle,
   `vercel.json` (build runs `npx prisma migrate deploy`), `/api/health`
   probe, static SPA serving.

## Integrations ready behind interfaces (credential/ops-gated)

6. **Real AI smoke run**: run `AI_MODE=real` `AnalyzeCompany` +
   `POST /api/placement-plan` on the deploy with `OPENCODE_API_KEY` set;
   confirm zod validation and error mapping in prod logs.
7. **AI-search discovery credentials**: set `DISCOVERY_PROVIDER=ai-search` +
   `AI_SEARCH_API_KEY`/`AI_SEARCH_CAPABILITIES` when a search-capable AI
   provider is available.

## Integrations that still require development (NOT built today)

8. **One real placement provider adapter** (e.g. Yandex Business API or 2GIS
   API): discover → classify → approve → execute → monitor → verify with
   `MEASURED` evidence. Document the verified capability first
   (INTEGRATIONS.md policy). **Until this exists, no real external placement
   occurs** and the product's automated execution story is demo-only.
9. **Real SEO metrics** (Ahrefs/Semrush/Similarweb/GSC) behind
   `SeoMetricsProvider` to enrich plan inputs with `MEASURED` donor data.
10. **Real outreach/email integration** behind `OutreachProvider` (sending
    stays human-triggered; a real transport replaces the scenario provider).

## Production hardening still required

11. **Apply migrations to Neon and verify**: `npx prisma migrate deploy` runs
    in the Vercel build, but the apply must be confirmed on a real deployment
    (`/api/health` → `prisma: ok`). Local network cannot reach Neon (ADR-008);
    apply from CI/Vercel or a reachable network.
12. **Vercel env vars**: `DATABASE_URL`, `DIRECT_URL`, `OPENCODE_API_KEY`
    (and mode flags; `MOCK_PROVIDERS` — leave unset or `deny`, never `allow`).
13. **CI pipeline**: typecheck + lint + format:check + unit + E2E on every
    push; run integration tests on the CI network (where Neon is reachable).
14. **AuthN/AuthZ + multi-tenant campaign isolation**: no user model exists yet
    — P0 for multi-user SaaS; not needed for single-tenant internal use.
15. **Observability**: structured metrics (generation latency, AI success
    rates, plan automation %, verification pass rate), alerting, error
    tracking.
16. **Queue/background jobs** for plan generation and monitoring polls if
    portfolios/timeouts demand it (deferred in ADR-013).
17. **Per-company anchor profile** (currently `profileAvailable: false`),
    rejection recovery for BLOCKED/REJECTED (STATE_MACHINE.md), and full
    OpenAI/Anthropic provider support behind the existing AI abstraction.
18. **Load testing** of the reconciliation path (pure CPU) and the batched AI
    call under large opportunity sets.

## Non-goals (until explicitly requested)

- Real autonomous execution without human approval (ADR-004 stands).
- Email capture / billing / SaaS onboarding.
- Replacing the deterministic reconciliation with free-form AI decisions (ADR-013).
