# ADR-015: MOCK Provider Policy — Opt-in by Explicit Configuration

## Status

Accepted

## Decision

MOCK placement providers are bound into the delivery composition **only when
`MOCK_PROVIDERS=allow` is explicitly set**. The default is `deny`, parsed at
startup by `apps/api/src/runtime-config.ts` into
`RuntimeConfig.allowMockProviders` and applied at the provider registry
boundary (`buildRegistry(providers, allowMockProviders)` in
`apps/api/src/prisma-environment.ts`):

- `deny` (default): no synthetic implementations are bound. MOCK records stay
  out of `listByPlatformId` and `resolve` rejects them with
  `ProviderUnavailableError`. Automated execute/monitor/verify against
  synthetic providers is therefore impossible in production. MANUAL providers
  remain listed (the human-in-the-loop flow keeps working), but requesting a
  synthetic implementation for them fails with `ProviderNotFoundError` —
  verification results are never fabricated.
- `allow`: the demo/test/preview compositions bind `MockPlacementProvider`
  implementations so the full placement lifecycle can be demonstrated.
- Any unrecognized value fails startup with `RuntimeConfigError` — the
  product never silently enables mocks (the "no silent fallback" rule).

The policy lives exclusively at the composition/registry boundary: the domain
alignment logic (`selectBestProvider`, `deriveProviderAlignment`) and the
application use cases are unaware of it.

## Context

The P0 readiness requirement "production composition must pass
`allowMocks: false`" existed only as documentation: the production
composition root hardcoded `{ allowMocks: true }`, so a seeded MOCK provider
(`provider-yandex-business-mock` and friends, all `capabilitiesVerified`)
could be selected by pure domain logic and drive a placement through
EXECUTE → MONITOR → VERIFIED with fabricated `https://mock.example/...`
evidence. The environment policy was not expressible at all — there was no
flag between the demo and production compositions.

## Alternatives considered

- Gate on `NODE_ENV` (`allowMocks: NODE_ENV !== 'production'`): rejected —
  `NODE_ENV` is a deployment convention with local-development surprises
  (`NODE_ENV=production` is routinely set for bundlers/builds), while the
  mock policy is a real environment safety decision that must be explicit
  and auditable. The anti-mock rule also belongs to production only; test and
  preview environments legitimately need mocks without being "production".
- Reject MOCK entities at the repository/seed level (never load MOCK rows in
  production): rejected — the catalog is a single shared dataset; provider
  records carry alignment/intel value in read paths, and filtering at the
  registry keeps the policy exactly where the registry contract defines it.
- Hard error when a MOCK provider is resolved (instead of the existing
  `ProviderUnavailableError` semantics): rejected — the registry already
  implements the allow/deny contract; extending it with a config flag
  required no domain or application changes.

## Consequences

- Production cold start with `MOCK_PROVIDERS` unset or `deny` cannot execute
  placements through synthetic providers; the manual flow and real provider
  integrations (ADR-012) are unaffected.
- `pnpm demo` / E2E / unit fixtures keep mocks enabled explicitly (the demo
  composition in `apps/api/src/scenario/nordhaus-fixtures.ts` hardcodes
  `allowMocks: true` — the demo scenario is opt-in by definition).
- `.env.example`, `INTEGRATIONS.md`, `PRODUCTION_ARCHITECTURE.md`,
  `PRODUCTION_READINESS.md` and `PRODUCTION_ROADMAP.md` now describe the
  real mechanism; P0#3 is implemented, not aspirational.
- Covered by: runtime-config unit tests (default/allow/deny/unknown),
  composition policy unit tests (`tests/unit/apps/mock-provider-policy.test.ts`)
  and the Neon-gated integration test
  (`tests/integration/production-composition.test.ts`).
- Operators who later set `MOCK_PROVIDERS=allow` in production do so
  explicitly; the UI continues to label demo placements ("демо-провайдер").
