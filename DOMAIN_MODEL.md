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

## Platform

A catalog record of an external platform (name, URL, country, category, notes). Reusable research data; a platform being listed does not imply that automated publication is supported.

## PlacementProvider

A concrete integration binding for a platform: provider type (API / BROWSER / MANUAL / MOCK), explicit capability set and a `capabilitiesVerified` flag. One provider record per platform per type. See ADR-006.

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
       └── PlacementOpportunity
              └── Placement
                    └── Verification
                          └── Evidence

PlacementOpportunity
  ├── PlacementCategory
  ├── Platform
  └── PlacementProvider (via Placement)
```
