# ADR-001: Use a Modular Monolith

## Status
Accepted

## Decision

Use a modular monolith for the prototype.

## Context

The prototype needs clear domain boundaries but does not justify microservice deployment complexity.

## Consequences

Positive:
- simple deployment
- simple local development
- clear internal boundaries
- easy testing
- future extraction remains possible

Negative:
- modules share a deployment unit
- boundaries are enforced by code structure rather than network isolation
