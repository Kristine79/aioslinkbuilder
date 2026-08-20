# AI OS — Link Building Module
## Product Requirements Document

**Status:** Prototype MVP  
**UI language:** Russian  
**Code and technical documentation:** English  
**Synthetic demo company:** Nordhaus

## 1. Product goal

Build a prototype of a future AI OS module that helps businesses discover, evaluate, execute, and verify online placement opportunities.

The system must answer four questions:

1. Which placement opportunities are relevant to this business?
2. Why are they relevant?
3. How can the placement be executed: API, semi-automated, browser, outreach, or manual?
4. Was the expected result actually achieved?

This is not a backlink database. A placement may produce a backlink, brand mention, business profile, product listing, editorial publication, social presence, or referral traffic.

## 2. Core workflow

Company → AI Analysis → Placement Strategy → Opportunity Discovery → Classification → Scoring → Human Approval → Execution → Verification → Monitoring

## 3. Demo company

### Nordhaus

Premium made-to-order furniture manufacturer.

**Geography:** Moscow + Russia

**Products:**
- kitchens
- wardrobes
- built-in furniture
- upholstered furniture
- furniture for premium interiors

**Target audiences:**
- premium property owners
- interior designers
- architects
- developers
- HoReCa

Nordhaus is synthetic demo data and must never be represented as a real client.

## 4. Placement categories

MVP categories:

1. Maps & local directories
2. Furniture directories
3. Interior & design
4. Architecture
5. Professional platforms
6. Media & PR
7. Social platforms
8. B2B & regional platforms

Categories are data, not hard-coded UI components.

## 5. Placement result types

- BACKLINK
- BRAND_MENTION
- BUSINESS_PROFILE
- DIRECTORY_LISTING
- PRODUCT_LISTING
- EDITORIAL_PUBLICATION
- SOCIAL_PROFILE
- REFERRAL_TRAFFIC

Do not classify every placement as a backlink.

## 6. Opportunity model

Each discovered platform becomes a `PlacementOpportunity`.

An opportunity describes a potential placement. It is not proof that a placement has happened.

A completed external action becomes a `Placement`.

A verified result becomes a `Verification`.

## 7. Scoring

Final score must be deterministic and transparent.

Initial weights:

- topical relevance: 30%
- audience match: 20%
- geographic relevance: 15%
- authority: 15%
- placement quality: 10%
- automation potential: 10%

The AI may produce semantic inputs and explanations, but it must not invent the final score.

Store the score breakdown.

## 8. Automation

Each opportunity must expose:

- placement method: API / semi-automated / browser / manual / outreach / unknown
- provider capabilities: discover / validate / create / update / getStatus / verify

Never claim an API capability unless it has been verified.

Unsupported capabilities must be explicit.

## 9. Human approval

External actions must support human approval.

Before execution, show:
- platform
- category
- placement type
- score
- score breakdown
- recommendation reason
- integration method
- expected cost, if known
- company data to be submitted

## 10. Verification

`SUBMITTED` is not success.

A placement can become `VERIFIED` only after evidence confirms the expected result.

Evidence may include:
- live URL
- screenshot
- matched company name
- matched website
- expected backlink
- verification timestamp

## 10.1 Demo vs production execution

The MVP vertical slice is demonstrated end-to-end using **mock execution**:
`MockPlacementProvider` simulates a submission lifecycle so the full workflow
can be shown without external credentials or side effects. Mock execution is a
legitimate, explicit part of the demo/test vertical slice, but it is not real
external placement.

- MOCK providers are allowed **only** in explicit demo/test composition
  (`MOCK_PROVIDERS=allow`). The default production composition excludes them
  (`MOCK_PROVIDERS=deny`), so automated execution against a synthetic
  provider is impossible in production.
- A mock execution is **never presented as a real external placement**. UI
  provenance labels keep demo/synthetic data distinct from real
  measurements.
- Real placement execution requires a real provider/integration, which is a
  separate effort from this MVP slice.
- The domain model still contains `MOCK` as a legitimate provider type because
  demo/test workflows require it; the demo-vs-production policy is enforced
  at the composition/registry boundary, not in the domain.

The MVP itself is defined by §2–§13 below. Mock execution is one mechanism
within the MVP to demonstrate one complete vertical slice, not an expansion of
the product scope.

## 11. MVP screens

1. Campaign
2. AI Analysis
3. Placement Strategy
4. Opportunities
5. Opportunity details
6. Placement execution/status
7. Verification
8. Audit Log

The UI should be functional and restrained. Do not build a large dashboard for the sake of visuals.

## 12. MVP acceptance criteria

A reviewer must be able to:

1. open the demo campaign for Nordhaus
2. run company analysis
3. view recommended categories
4. view placement opportunities
5. filter opportunities
6. inspect score and explanation
7. inspect integration capabilities
8. approve a placement
9. execute a mock placement
10. see state changes
11. run verification
12. see `VERIFIED`
13. inspect audit history

## 13. Explicitly out of scope

- authentication
- billing
- multi-tenancy
- mass real-world submissions
- dozens of real integrations
- full outreach CRM
- full SEO analytics platform
- automated link purchasing
- production-scale scraping
- complex multi-agent orchestration

The prototype should demonstrate one complete vertical slice rather than many incomplete features.
