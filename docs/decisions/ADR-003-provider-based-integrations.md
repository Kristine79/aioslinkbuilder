# ADR-003: Provider-Based External Integrations

## Status

Accepted

## Decision

All external placement integrations must implement a provider abstraction.

## Rationale

The system must support API, browser, manual and mock execution without coupling domain logic to individual platforms.

Adding a new platform should not require changes to core business rules.
