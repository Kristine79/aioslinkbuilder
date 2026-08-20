# Domain Model

## Company

Represents a business being promoted.

Key fields:
- id
- name
- description
- industry
- geography
- locations
- products
- targetAudience
- website
- metadata

## Campaign

Represents a placement campaign for one company.

Key fields:
- id
- companyId
- name
- goals
- status
- createdAt
- updatedAt

Campaign status: `DRAFT`, `ACTIVE`, `COMPLETED` (defined in Phase 0; see ADR-007).

## PlacementCategory

A reusable classification such as:
- furniture
- interior
- architecture
- local
- media
- social

Categories are reusable platform data.

## PlacementStrategy

A derived (not persisted) deterministic strategy for a campaign, built from a
validated company analysis. It is a list of **strategy directions**, each with
a `categoryCode`, `categoryName` and a placement type (default
`DIRECTORY_LISTING` when no category-specific default applies), plus the
analysis' strategic recommendations.

A direction is either:

- **catalog-backed** — `categoryId` set; the direction matches a
  `PlacementCategory` that exists in the catalog (used for normalization,
  known placement types and provider alignment);
- **AI-derived** — `categoryId === null`; the analysis named a topic the
  catalog has no category for. It stays an active strategy direction and can
  participate in discovery — a missing catalog category never removes a
  direction and never blocks real search results.

## Platform

A catalog record of an external platform (name, URL, country, category, notes). Reusable research data; a platform being listed does not imply that automated publication is supported.

## PlacementProvider

A concrete integration binding for a platform: provider type (API / BROWSER / MANUAL / MOCK), explicit capability set and a `capabilitiesVerified` flag. One provider record per platform per type. See ADR-006.

## DiscoveryRun

A persisted record of one discovery attempt for a campaign. The backend is the
single source of truth for discovery state: the UI distinguishes "search never
ran" from "search finished with no results" from "search failed" via this
entity, never via sessionStorage or the audit trail.

Key fields:
- campaignId (one run per campaign, `@@unique`)
- status — `NOT_RUN` (derived, never stored), `RUNNING`,
  `COMPLETED_WITH_RESULTS`, `COMPLETED_EMPTY`, `FAILED`
- lastRunAt, discoveredCount, classifiedCount
- sources (which discovery sources produced candidates)
- failure (message when `FAILED`)

A run is stored as RUNNING when discovery starts and transitions to exactly one
terminal state: WITH_RESULTS when the sources produced new opportunities,
EMPTY when they ran successfully but found nothing, or FAILED on a
provider/source error (a failed run must never be reported as EMPTY).

## PlacementOpportunity

A potential placement discovered for a campaign.

Key fields:
- id
- campaignId
- platformId
- categoryId
- placementType
- relevance
- score
- scoreBreakdown
- recommendation
- placementMethod
- providerCapabilities
- status
- metadata

## Placement

Represents an actual placement execution.

Key fields:
- id
- opportunityId
- providerId
- status (starts at `READY` for a new execution)
- externalId
- submittedAt
- publishedAt
- liveUrl
- metadata

## Verification

Represents a verification attempt/result.

Key fields:
- id
- placementId
- status
- checkedAt
- result
- failureReason

## Evidence

Evidence attached to a verification.

Possible types:
- LIVE_URL
- SCREENSHOT
- PAGE_CONTENT
- COMPANY_MATCH
- WEBSITE_MATCH
- BACKLINK_MATCH

## AIAnalysis

Stores structured AI analysis and its provenance.

Should include:
- analysis type
- provider/model
- input reference
- structured output
- createdAt

Never store unvalidated AI output as authoritative business state.

## AuditLog

Immutable record of important actions.

Fields:
- id
- timestamp
- actor
- action
- entityType
- entityId
- metadata

## Relationships

```text
Company
  └── Campaign
       ├── DiscoveryRun
       └── PlacementOpportunity
              └── Placement
                    └── Verification
                          └── Evidence

PlacementOpportunity
  ├── PlacementCategory
  ├── Platform
  └── PlacementProvider (via Placement)
```

## Link-building intelligence extension

These concepts extend the opportunity model (stored as typed JSON under the
`PlacementOpportunity.metadata` columns). They are analytical profiles and
AI-prepared artifacts; the placement lifecycle/state machine remains the
source of truth for operational state.

### Metric provenance

Every external metric carries:

- `value`
- `source` (e.g. `ahrefs`, `semrush`, `similarweb`, `gsc`, `demo`)
- `status` — `MEASURED` | `AI_ESTIMATED` | `INTERNAL` | `SYNTHETIC` | `UNKNOWN`
- `confidence` (AI estimates)
- `measuredAt`

The UI must never present `SYNTHETIC` or `UNKNOWN` values as real measurements.

### DonorQualityProfile

Quality profile of the donor domain: organic traffic, traffic geography,
keyword profile, backlink profile, authority (DR/DA-like), spam risk, indexation,
estimated real traffic, topical relevance, audience match, geographic
relevance, placement quality, automation potential — each with provenance —
plus a deterministic `overallDonorQuality` (0-100) and `overallLevel`.

### PageAnalysis

Page-level analysis. A donor domain and a specific placement page are different
entities: the domain carries the donor quality profile; the page carries the
concrete place where a link would be inserted (target page, title, page type,
topical relevance, link-insert suitability, indexation, traffic, outbound-link
signals, suggested placement location).

### Workflow (per placement type)

Each placement type declares the recommended workflow stages
(`PLACEMENT_TYPE_WORKFLOWS`). Outreach-driven types (`LINK_INSERT`,
`GUEST_POST`, `RESOURCE_PAGE`, `PARTNER_PAGE`) are executed via human outreach.

### Anchor strategy

`AnchorRecommendation` — recommended anchor type (exact/partial match, branded,
generic, url, long-tail), the anchor, alternatives, explanation and confidence.
`profileAvailable` stays false until a real campaign anchor profile exists.

### LinkInsert

`LinkInsertDraft` — anchor, alternatives, insertion point, a 1-3 sentence
contextual text, and an explanation of why the insertion is natural.

### Outreach

`OutreachDraft` with status `DRAFT → READY_FOR_REVIEW → APPROVED → SENT →
(REPLIED → NEGOTIATING) → AGREED / REJECTED / NO_RESPONSE`. Sending is
strictly human-in-the-loop: only an explicit human action invokes the
messaging provider.

### Negotiation

`NegotiationSession` + `NegotiationAnalysis`. The human pastes a donor reply;
the AI determines the intent (accepted, rejected, price negotiation, content
requirements, link attribute request, needs clarification, manual review) and
prepares a suggested response, strategy, recommended price range, fallback and
risks. The human approves and sends — never autonomous.

### Human-in-the-loop actions

`deriveHumanActions` deterministically derives the "Требует действия" cards
from the current state: review donor, approve opportunity, approve outreach,
donor replied, negotiate price, manual placement, confirm publication. Each
card states WHY the human is needed, WHAT the AI prepared and WHAT the human
must do.

---

## Placement plan (decision engine, ADR-013)

The AI placement plan is a **derived, read-side decision layer** (it is not
operational state and does not live in the state machine).

### PlacementPlanItem

Per-opportunity decision produced by the AI and re-reconciled by the domain:

- `opportunityId`
- `recommendation` — `RECOMMENDED` | `REVIEW_REQUIRED` | `NOT_RECOMMENDED`
  (domain `enums/placement-recommendation.ts`; the AI may suggest it, the domain
  reconciles it from current scores)
- `score` — effective deterministic score used for the bucket
- `reasons`
- `decision` — the reconciled outcome:
  - `nextAction` — e.g. `EXECUTE`, `REQUEST_REVIEW`, `REVIEW`, `RESEARCH_DATA`,
    scoped by automation mode
  - `automation` — `AUTOMATIC` | `AI_ASSISTED` | `MANUAL`
  - `executionMethod`
  - `isHumanRequired` / `needsApproval`
  - `providerAvailable`
  - `strategySupportsType`
  - `anchorRecommendation` — brand-anchor suggestion (AI) or stored
    `intel.anchorStrategy` (domain prefers the latter)
  - `commonRejection` — low score / high risk / insufficient data / no coverage

### PlacementPlan

- `campaignId`
- `generatedAt` / `sourceAnalysisId`
- `aiProviderLabel`
- `items` — one per discovered opportunity (exact coverage: no missing, no invented ids)
- `summary` — `weightedAutomationPercent`, `automationBreakdown`, `averageScore`,
  `totalRecommended`

Derivation: one batched AI call (`ScenarioAIProvider.generatePlacementPlan`) produces a
strict zod-validated decision map persisted as an `AIAnalysis` row of type
`PLACEMENT_PLAN` (`structuredOutput`). On read, `GetPlacementPlanUseCase` re-reconciles
the stored decision map against the **current** opportunity state, so score/provider
changes are reflected without a new AI call; generation failures surface as
`PlanGenerationFailedError` (502).
