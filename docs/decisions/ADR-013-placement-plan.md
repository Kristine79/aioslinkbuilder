# ADR-013: AI Placement Plan — Read-Side Decision Engine

## Status

Accepted

## Decision

The AI placement plan ("План размещений") is a **read-side decision layer** built
as **AI interpretation + deterministic reconciliation**:

1. **One batched AI call** (`AIProvider.generatePlacementPlan`, strict zod schema)
   interprets the deterministic signals (score, donor quality, risk, provider
   availability, execution method, strategy support) into a per-opportunity decision
   map (`RECOMMENDED` / `REVIEW_REQUIRED` / `NOT_RECOMMENDED`, suggested next action,
   automation mode, anchor suggestion).
2. The decision map is persisted as an `AIAnalysis` row of type `PLACEMENT_PLAN`
   (`structuredOutput`), with an `PLACEMENT_PLAN_GENERATED` audit event.
3. On every read, `GetPlacementPlanUseCase` **re-reconciles** the stored map against
   the **current** opportunity state via the domain `reconcilePlanDecision`. The
   domain is authoritative for the final bucket, next action and automation mode —
   the AI can never promote a low-scoring opportunity (verified by tests).

The plan exposes no placement-state transitions: approval/execution continue to run
exclusively through the existing state machine (`STATE_MACHINE.md`).

## Context

The prototype already produced per-opportunity intelligence (Score 2.0, risk, donor
quality, provider availability) but had no product-level answer to "what do I do with
these 16 opportunities first?". Options considered:

1. **Plain deterministic ranking** (sort by score and show a list) — already existed;
   did not produce a portfolio-level work plan, reasons for rejection, or
   automation-mode guidance.
2. **AI writes final decisions directly into business state** — violates ADR-002 /
   ADR-011 (AI never writes authoritative business state) and is not reproducible.
3. **AI interpretation + deterministic reconciliation (chosen)** — the AI adds
   portfolio-level judgment (why this order, what to watch), while the domain guards
   every numeric threshold and coverage invariant, keeping the output deterministic
   and testable.

Storage options: a new dedicated table repo vs. an existing `AIAnalysis` row of a new
enum value. The reused row keeps the demo/API running without a new repository and is
consistent with how every other AI output is already persisted (ADR-011 pattern);
the plan is materialized deterministically on demand, so the stored map is only an
AI-provenance artifact.

## Consequences

Positive:

- One AI call per portfolio instead of one per opportunity; deterministic regeneration
  on read; a generated plan equals itself across runs (covered by unit + E2E tests).
- Strict schema validation + coverage assertion (exact set of discovered ids — no
  missing, no invented).
- Human-in-the-loop preserved: recommended items are proposals; nothing is executed
  without approval.
- Production-safe: the same pipeline works with a real AI provider (schema-validated,
  fail-generates → 502) and with the deterministic `ScenarioAIProvider` (demo).

Negative / caveats:

- Adds a new `AIAnalysisType.PLACEMENT_PLAN` enum value — migration
  `20260819120000_placement_plan` must be applied to Neon (local network cannot reach
  the DB; apply from Vercel/CI, see ADR-008).
- The plan is derived state: concurrent score/provider changes are reflected at read
  time, so the stored AI map may differ from the reconciled output (by design).
- Coverage requires exact ids from a single load; a new opportunity invalidates the
  stored map until regeneration (`PlanGenerationFailedError`, 502).

## Out of scope (explicitly deferred)

Queue/background regeneration, per-campaign scheduling, and AI-initiated execution —
the plan is generated on demand (`POST`) and always read latest (`GET`).
