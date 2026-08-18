# ADR-010: Platform Discovery Sources

## Status

Accepted

## Decision

Opportunity discovery is modeled as a **discovery-source port** in the application layer (`PlatformDiscoverySource`), not as hard-coded catalog reads inside a use case.

- The seeded platform catalog is the **first concrete discovery source** (`CatalogPlatformDiscoverySource`), not the architectural limit of discovery.
- `DiscoverOpportunitiesUseCase` iterates over injected sources, deduplicates candidates per campaign/platform, applies the category filter and creates DISCOVERED opportunities.
- Future discovery providers (API-based lookups, AI/web research) implement the same port and plug in without domain or application changes.
- Candidates reference an existing catalog platform via `platformId`; a source that finds a brand-new site must persist it in the catalog first (no `PlatformWriter` port yet — added when a source needs it).

## Context

During Phase 2 planning it was clarified that the seeded catalog is demo data, not a product limit: discovery must stay extensible so API-based and AI/web-research discovery can be added later. The existing `DiscoverOpportunitiesUseCase` read the catalog directly through `LookupRepository`, which would have forced application changes for every new discovery mechanism. The placement state machine, deterministic scoring and provider alignment remain untouched by this decision.

## Rationale

- Keeps the discovery question ("which platforms are relevant") separate from catalog data access.
- Application logic stays source-agnostic: no site-specific conditionals in use cases.
- The catalog source stays trivially simple (pure read of lookup data) while leaving room for sources with real external calls, which will live behind the same port.

## Consequences

Positive:

- adding a discovery mechanism is a new source implementation + composition change, no domain/application edits
- discovery candidates and filters are uniform (category code based), so the UI can stay stable

Negative:

- discovery sources are application-layer code; sources that need real I/O will depend on `integrations` (acceptable — sources are application workflows)
- candidates without a registered platform are silently skipped for now; the behavior will need revisiting when a source discovers new sites

## Related decisions

- ADR-006 (Platform vs PlacementProvider separation — providers stay per-platform records)
- ADR-009 (application layer composition — sources follow the same port pattern as repositories)
