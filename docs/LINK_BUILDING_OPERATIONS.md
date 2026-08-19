# Link-Building Operations Playbook

End-to-end operational flow of the AI Link Building Module, in the order the
product lets you (or the operator) run it. The authoritative state contract is
`STATE_MACHINE.md`; scoring rules live in `SCORING.md`; interfaces in
`ARCHITECTURE.md` / `INTEGRATIONS.md`.

## 1. Company → Campaign

1. Create a company (name, description, industry, geography, locations,
   products, target audience, website).
2. Create a campaign bound to the company (goals, status DRAFT/ACTIVE).
3. `AnalyzeCompany` — AI classifies the company; the validated
   `COMPANY_ANALYSIS` (relevant categories) seeds the strategy.

## 2. Strategy

`GeneratePlacementStrategy` maps each relevant category to a placement strategy
(BUSINESS_PROFILE / DIRECTORY_LISTING / EDITORIAL_PUBLICATION / ...), each with
recommended placement types and methods.

## 3. Discovery

`DiscoverOpportunities` runs every configured discovery source (seeded catalog,
web-search in `DISCOVERY_MODE=real`) and persists deduplicated candidate
opportunities (platform + category + method).

## 4. Classification + scoring

1. `ClassifyOpportunity` — deterministic score 0–100 with breakdown
   (SCORING.md, Score 1.0).
2. `AssessOpportunity` — donor quality profile, page analysis, risk level
   (LOW/MEDIUM/HIGH), Score 2.0 overall. External metrics always carry
   provenance (`MEASURED` / `AI_ESTIMATED` / `INTERNAL` / `SYNTHETIC` /
   `UNKNOWN`) — the UI shows real vs demo data.
3. Optional preparation per method: `GenerateLinkInsert`, `RecommendAnchor`
   (for LINK_INSERT placements), `GenerateOutreach` (outreach DRAFT),
   negotiation thread when a donor replies.

## 5. AI placement plan (decision engine)

The «План размещений» is the **entry point** for working the portfolio (ADR-013):

1. `POST /api/placement-plan` (or `/api/campaigns/:id/placement-plan`) — one
   batched AI call interprets the deterministic signals per opportunity:
   - `RECOMMENDED` — effective score ≥ 75, no high-risk blocker; carries the
     next action and automation mode (AUTOMATIC / AI_ASSISTED / MANUAL).
   - `REVIEW_REQUIRED` — score 55–74, or HIGH risk, or no verified CREATE
     provider for the automatic path; human review expected.
   - `NOT_RECOMMENDED` — score < 55, insufficient data, or explicit rejection
     reason (low score / high risk / no coverage).
     The decision map is persisted as an `AIAnalysis` (type `PLACEMENT_PLAN`).
2. `GET /api/placement-plan` — materializes the plan by **deterministic
   re-reconciliation** against current state (provider/score changes reflect
   without a new AI call). Coverage is exact: never missing/invented ids.
3. The operator starts with `pickRecommendedToStart` items (e.g. Яндекс Бизнес,
   2ГИС) — "С чего начать" in the UI.

## 6. Approval (human-in-the-loop)

Per recommended/review-required opportunity the human either:

- Approves → `SELECTED` (from here automatic execution can start), or
- Requests manual execution → `NEEDS_MANUAL`.

Nothing is submitted externally without an explicit human action. Outreach
sending is `APPROVED → SENT` only (human-triggered); negotiation replies are
sent only after the human approves the AI-prepared response.

## 7. Execution

`ExecutePlacement` selects the best provider (API > BROWSER > MANUAL priority,
verified CREATE+VERIFY capabilities; MOCK excluded in production) and runs it:

- Automatic: `READY → SUBMITTED → PENDING_PUBLICATION → PUBLISHED`.
- Manual: `NEEDS_MANUAL → PUBLISHED` only with proof (external reference +
  public URL).
- Failures are terminal per attempt: retry creates a fresh Placement record;
  double submission is impossible while an attempt is active.

## 8. Monitoring

`MonitorPlacement` polls provider status (`getStatus`) until terminal.
Stuck states surface as `BLOCKED`/`REJECTED`/`FAILED` and stay in the audit
trail.

## 9. Verification + evidence

`VerifyPlacement` confirms the result (LIVE_URL / SCREENSHOT / PAGE_CONTENT /
COMPANY_MATCH / WEBSITE_MATCH / BACKLINK_MATCH) → `VERIFIED`. If evidence does
not confirm → `VERIFICATION_FAILED`.

## 10. Audit

Every state change and AI action emits an immutable audit event (actor
`system` for automation, `human` for manual actions): the activity journal
(`GET /api/activity`) reconstructs everything that happened, including
`PLACEMENT_PLAN_GENERATED`.

---

## Operational rules (non-negotiable)

- Human approval precedes any external action; AI never mutates placement state
  (the state machine is the only authority).
- The placement plan is a read-side decision layer — it does not create states
  or bypass transitions.
- MOCK providers are excluded at the composition boundary in production
  (`allowMocks: false`).
- Demo/synthetic data is always labeled; never present `SYNTHETIC` as measured.
- Without a verified CREATE capability, automatic execution is impossible —
  the plan still works, marking the item for review/manual.
