# ADR-008: Phase 0 Tooling

## Status

Accepted

## Decision

Phase 0 tooling:

- **Monorepo**: pnpm workspaces (`packages/*`), each layer a private workspace package consuming TS sources directly (no build step in Phase 0; Vitest and TypeScript resolve sources).
- **Language**: strict TypeScript (ES2022, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`), no `any`.
- **Tests**: Vitest with three suites — `tests/unit` (pure, no DB), `tests/integration` (PostgreSQL via Neon, skipped without `DATABASE_URL`), `tests/e2e` (scaffold, Phase 6).
- **Linting/formatting**: ESLint 9 flat config with `typescript-eslint` recommendedTypeChecked + Prettier.
- **ORM**: Prisma 6 with PostgreSQL; database layer reads `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) and stays provider-agnostic (Neon is used as the actual Postgres infrastructure).
- **Validation**: zod for AI output schema validation in `packages/ai`.
- **No UI, no external integrations, no AI vendor code** in Phase 0.

Not created: `packages/shared` (nothing to share yet — domain types flow through `@aios/domain`).

## Context

ARCHITECTURE.md defines layering and boundaries but not concrete frameworks. "Do not add libraries unless there is a clear reason" applied: Vitest (TS-native runner), zod (AI output schemas), Prisma (migrations + typed client), ESLint/Prettier (required by the task).

## Consequences

Positive:

- layering is enforced by package boundaries, not discipline
- AI output is schema-validated before it can influence business state
- migrations are ordinary Prisma migrations applied via `prisma migrate dev` / `deploy`

Negative:

- packages ship TS sources directly; a build step (tsc/tsup) is needed before the API service runs outside Vitest
- Prisma enums and domain unions are declared twice (schema + domain) and must be kept in sync manually; a test asserting sync can be added in a later phase

## Database connectivity note

The Neon direct (non-pooler) endpoint is unreachable from the local development network (connections reset), while the pooled endpoint works. Locally, `DIRECT_URL` therefore points at the pooled endpoint. On Vercel/CI the native direct endpoint should be used. This is a network property of the dev machine, not an application-level assumption; the application layer remains provider-agnostic.
