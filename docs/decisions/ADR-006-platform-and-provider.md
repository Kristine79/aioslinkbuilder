# ADR-006: Separate Platform and PlacementProvider Entities

## Status

Accepted

## Decision

Model external platforms as two separate domain entities:

- `Platform` — catalog record of an external site (name, URL, country, category, notes). Reusable research data, not tied to any integration.
- `PlacementProvider` — a concrete integration binding for a platform (`providerType`: API / BROWSER / MANUAL / MOCK) with an explicit capability set and a `capabilitiesVerified` flag.

A `PlacementOpportunity` references the `Platform` (`platformId`); a `Placement` references the `PlacementProvider` (`providerId`).

## Context

DOMAIN_MODEL.md assigns `platformId` to `PlacementOpportunity` and lists `PlacementProvider` as a core entity, while the relationships diagram says "Platform / Provider" — ambiguous whether these are one entity or two. INTEGRATIONS.md treats provider records as per-platform capability declarations ("Provider: ExampleDirectory ... discover: true").

## Rationale

- A single platform can be integrated in multiple ways (e.g. an official API and a browser flow), which must be declared and verified separately.
- PRD requires: "Never claim an API capability unless it has been verified" — a per-provider `capabilitiesVerified` flag makes verified capabilities explicit.
- Opportunity semantics ("which platform") and execution semantics ("through which integration") stay distinct, mirroring the documented PlacementOpportunity != Placement != Verification separation.

## Consequences

Positive:

- capability declarations belong to integration records, not catalog data
- verified/unverified capability status is explicit
- adding a second integration method for an existing platform requires no domain changes

Negative:

- two records to maintain per platform-integration pair
- `@@unique([platformId, providerType])` enforces one provider per type per platform
