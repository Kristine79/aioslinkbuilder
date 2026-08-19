# ADR-014: PostgreSQL as the Production Persistence Backbone

## Status

Accepted

## Decision

The Vercel serverless deployment and `pnpm start` now run on the
**Prisma-backed environment** (`apps/api/src/prisma-environment.ts`): all
nine repositories (company, campaign, lookup, opportunity, placement,
verification, evidence, AI analysis, audit log) are the Prisma
implementations over PostgreSQL (Neon). The in-memory Nordhaus environment
remains only for local demo fallback, `pnpm demo`, unit tests and E2E.

Consequences:

- The delivery layer depends on a shared `ApiEnvironment` contract
  (`apps/api/src/environment.ts`) built from the application ports; the
  concrete repository classes are injected by the composition root. Two
  ports were extended for delivery-layer reads: `CompanyRepository.all()`
  (company list) and `AuditLogRepository.findByEntityIds()` (activity feed).
- `scripts/vercel-entry.ts` is persistence-first: if PostgreSQL is
  unreachable the cold start fails (500) — the product never silently falls
  back to in-memory data in production.
- `apps/api/src/server.ts` follows the same policy when
  `NODE_ENV=production`. On a local dev machine without database
  reachability it falls back to the in-memory Nordhaus demo **with an
  explicit warning** that data will not be persisted.
- `@prisma/client` is external to the Vercel esbuild bundle
  (`--external:@prisma/client` in `build:vercel:api`): the generated client
  and its query engine are resolved from `node_modules` on the Vercel
  runtime, exactly like the `api/health` function already does.
- The catalog/platform/provider lookups are loaded once via
  `pnpm db:seed` (idempotent upserts) and are required at startup — an
  empty catalog is a startup error, not an empty UI.
- The placement provider registry is still in-memory (MockProvider
  implementations bound to database provider records). Real platform
  integrations remain a separate effort (ADR-012).

## Context

The deployment on Vercel served every request through in-memory
repositories: data created via the UI lived in a single warm serverless
instance and disappeared on cold start — from the outside the product
appeared to have "no database at all". All Prisma repository
implementations already existed in `packages/infrastructure` but were used
only by integration tests. This ADR connects them to the delivery
composition roots (Vercel + `pnpm start`) so user data persists across
instances and cold starts.

## Alternatives considered

- Seed the in-memory Nordhaus scenario per warm instance (status quo):
  unacceptable — data loss on every cold start, no multi-instance
  consistency.
- Run the Nordhaus demo bootstrap against the database on every Vercel
  cold start: rejected — a serverless cold start cannot spend minutes
  seeding, and synthetic demo companies must not appear in user data.
- Bundle `@prisma/client` into the serverless bundle: rejected — the
  generated client locates its query engine relative to its own package;
  keeping it external matches the proven `api/health.mjs` path.