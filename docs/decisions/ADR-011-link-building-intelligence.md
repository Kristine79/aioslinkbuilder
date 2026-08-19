# ADR-011: Link-Building Intelligence Profiles on the Opportunity

## Status

Accepted

## Decision

The link-building intelligence extension (donor quality, page-level analysis,
anchor strategy, link insert, outreach, negotiation, Score 2.0, risk) is
stored as **typed JSON under the `PlacementOpportunity.metadata` column**,
read/written through a single typed helper (`readIntel` / `writeIntel` in
`packages/application/src/intel/`), rather than as a set of dedicated
relational tables.

The intelligence is exposed through new application-layer **ports**:

- `SeoMetricsProvider` (Ahrefs / Semrush / Similarweb / GSC)
- `PageAnalysisProvider` (crawler)
- `OutreachProvider` (messaging/email)

New AI provider methods (`analyzePage`, `generateLinkInsert`, `recommendAnchor`,
`generateOutreach`, `analyzeNegotiationReply`, `estimateDonorQuality`,
`assessDonorRisk`) all return zod-validated *semantic* output that the
application layer wraps into domain state with the correct `MetricStatus`
(e.g. `AI_ESTIMATED`). AI never writes a final numeric score.

## Context

The prototype needed to demonstrate the full "AI Link Building Copilot"
workflow end-to-end: donor quality, page-level opportunities, anchor strategy,
outreach (HITL) and negotiation. Two storage options were considered:

1. **Dedicated PM (row) models** for donor quality, page analysis, outreach
   threads, negotiation sessions, etc. Highest normalization, but large schema +
   repository + mapping churn for what is largely analytical/AI-prepared data.
2. **JSON on the existing opportunity metadata** (with typed read/write
   helpers), keeping only the operational lifecycle (placement/verification
   state machine) in proper columns.

The existing schema already stores discovery metadata and manual placement
notes in the same `metadata` JSON column, so option 2 is consistent with the
current model and keeps the Demo/API fully working without a database
migration or repository duplication.

## Consequences

Positive:

- No new tables/repositories; the demo and API continue to run on in-memory
  repositories with no DB dependency.
- The intel is co-located with the opportunity it describes; `readIntel` is the
  single typed access path.
- New provider ports keep real SEO/crawler/email integrations pluggable behind
  the same abstractions; unknown metrics degrade to `UNKNOWN`/`AI_ESTIMATED`.

Negative / caveats:

- Intel is schema-less at the DB level; type safety relies on the typed helper
  (no DB constraint). If the intel grows into queryable operational state,
  dedicated models should be introduced behind the same use cases.
- `PlacementType` and `AIAnalysisType` enums gained new values (`LINK_INSERT`,
  `GUEST_POST`, `RESOURCE_PAGE`, `PARTNER_PAGE`; `PAGE_ANALYSIS`,
  `LINK_INSERT_PREPARATION`, `ANCHOR_RECOMMENDATION`, `OUTREACH_MESSAGE`,
  `NEGOTIATION_ANALYSIS`, `DONOR_QUALITY_ESTIMATES`, `DONOR_RISK`). The
  corresponding migration
  (`.../prisma/migrations/20260818120000_link_building_intel/migration.sql`)
  must be applied to Neon (`prisma migrate dev`) when the database is
  reachable; until then the in-memory/API demo uses them directly.

## Human-in-the-loop principle

Outreach is never sent automatically. `UpdateOutreachStatusUseCase` enforces
the domain `OUTREACH_TRANSITIONS`; only the explicit, human-triggered
`APPROVED → SENT` transition invokes the `OutreachProvider`. Negotiation is
assisted, never autonomous: `RespondNegotiationUseCase` records the human's
decision before the thread resolves.
