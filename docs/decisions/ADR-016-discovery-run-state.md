# ADR-016: Server-Side Discovery Run State — Backend as Source of Truth

## Status

Accepted

## Decision

Every discovery attempt for a campaign persists a durable **discovery run**
row. The backend is the single source of truth for discovery state; the UI no
longer infers discovery status from session storage or audit-log heuristics.

- New domain aggregate `DiscoveryRun` (`packages/domain/src/discovery-run.ts`)
  with a closed status set: `NOT_RUN | RUNNING | COMPLETED_WITH_RESULTS |
COMPLETED_EMPTY | FAILED`. One row per campaign (`@@unique` on
  `campaignId`, enforced by migration `20260819180000_add_discovery_run`).
- New application port `DiscoveryRunRepository` (in-memory for demo/tests,
  Prisma for production) with `findLatestForCampaign` / `save`. In-memory
  stores by `campaignId`; Prisma upserts on the unique `campaignId`.
- `DiscoverOpportunitiesUseCase` owns the run lifecycle: it writes `RUNNING`,
  then **exactly one terminal state**:
  - `COMPLETED_WITH_RESULTS` — sources produced new opportunities;
  - `COMPLETED_EMPTY` — sources ran successfully but found nothing;
  - `FAILED` — a provider/source error aborted the run. A failed run is
    **never** reported as `COMPLETED_EMPTY`, so the UI keeps distinguishing
    "no results" from "the search did not complete".
  - `recordClassified(campaignId, count)` backfills the classified count into
    the same run after classification, since classification runs after discovery.
- `NOT_RUN` is a derived state: it is never stored as a row. The repository
  returns `null` and the delivery layer serializes it as `NOT_RUN`.
- Delivery exposes `GET /api/discovery-state` returning
  `ApiDiscoveryStateDto` (status, discoveredCount, classifiedCount, sources,
  failure). The web UI consumes it via `useDiscoveryState`.
- Plan rows now carry `providerType` (`ProviderType | null`, `null` for
  OUTREACH) so the UI can mark MOCK rows as demo directly from the DTO
  without an extra opportunities lookup.

## Context

Discovery previously had no durable result outside the opportunities table
and audit log. The UI reconstructed "discovery happened / failed / ran"
heuristically (session storage, audit events), which is not a reliable source
of truth: on refresh, across devices, or after a failed run it drifted from
what the backend actually did. A provider failure produced a client-side
error without a persisted record, and there was no way to distinguish a
completed-but-empty search from a run that never succeeded.

The P0 requirement "persist discovery run state (backend source of truth)"
was documented but not implemented.

## Alternatives considered

- Keep deriving discovery state in the UI from the audit log: rejected — audit
  entries are append-only records of actions, not a queryable per-campaign
  status; deriving a state machine from them duplicates business meaning into
  the client and breaks refresh/device consistency.
- Store the run inside the existing `Campaign` row: rejected — discovery state
  is a lifecycle aggregate of its own (run metadata, sources, failure cause)
  with different write frequency than the campaign; a separate table keeps
  campaign reads stable and matches the existing per-aggregate repository
  pattern.
- Re-run discovery state reconstruction from opportunities (`has opportunities
⇒ completed`): rejected — it cannot represent `COMPLETED_EMPTY` or `FAILED`,
  the two states the reporting requirements explicitly need.

## Consequences

- The backend reliably distinguishes: never run (`NOT_RUN`), in flight
  (`RUNNING`), found something (`COMPLETED_WITH_RESULTS`), ran clean but empty
  (`COMPLETED_EMPTY`), and failed (`FAILED` with the underlying error text).
- A provider/source failure is persisted with the failure message; the smoke
  path demonstrated this end-to-end (`FAILED` terminal state, no silent
  `COMPLETED_EMPTY` reinterpretation).
- Two repository implementations exist (in-memory + Prisma); the production
  composition binds the Prisma repository, demo/tests bind in-memory — the
  composition picks the implementation, the domain/application stay behind the
  port.
- The migration is additive and reversible with a standard down migration;
  no existing data is rewritten.
- Covered by unit tests (`tests/unit/domain/discovery-run.test.ts`, use-case
  lifecycle tests) and the Neon-gated integration suite (production-composition
  path).
