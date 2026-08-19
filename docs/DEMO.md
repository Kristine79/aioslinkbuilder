# Demo

The deterministic end-to-end demo (in-memory, **no database**, no network) runs the
full Nordhaus scenario on the MockProvider. It is the primary way to see the whole
product working on one command:

```bash
pnpm demo
```

## What it shows

| Step   | Action                           | Output                                                                                                                                  |
| ------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `[0]`  | Seed Nordhaus company + campaign | company/campaign ids                                                                                                                    |
| `[1]`  | `AnalyzeCompany`                 | VALID `COMPANY_ANALYSIS` (4 relevant categories)                                                                                        |
| `[2]`  | `GeneratePlacementStrategy`      | each category mapped to a strategy (BUSINESS_PROFILE / DIRECTORY_LISTING / EDITORIAL_PUBLICATION)                                       |
| `[3]`  | `DiscoverOpportunities`          | 16 opportunities discovered from the seed catalog                                                                                       |
| `[4]`  | `ClassifyOpportunity`            | deterministic scores + placement type per platform                                                                                      |
| `[4b]` | `AssessOpportunity`              | donor quality + page analysis + risk + Score 2.0 (synthetic demo data, labeled `SYNTHETIC`)                                             |
| `[4c]` | `GenerateLinkInsert`             | Houzz link-insert draft, outreach status DRAFT                                                                                          |
| `[4d]` | Negotiation                      | Houzz donor reply classified as `CONTENT_REQUIREMENTS`                                                                                  |
| `[4e]` | **PlacementPlan**                | per-platform decisions: 2 RECOMMENDED (Яндекс Бизнес, 2ГИС, AUTOMATIC), 10 REVIEW_REQUIRED, 4 NOT_RECOMMENDED; summary `automation 13%` |
| `[5]`  | Approve                          | 5 opportunities SELECTED                                                                                                                |
| `[6]`  | Execute                          | PUBLISHED (Яндекс Бизнес, Мебель.ру), SUBMITTED (2ГИС), first attempt FAILED on Archi.ru → fresh attempt PUBLISHED                      |
| `[7]`  | Monitor                          | 2ГИС advances to PUBLISHED                                                                                                              |
| `[8]`  | Manual flow                      | INMYROOM → NEEDS_MANUAL → PUBLISHED with proof (externalId + liveUrl)                                                                   |
| `[9]`  | Verify                           | all five placements VERIFIED                                                                                                            |

The audit journal (system actor) is printed at the end —
`PLACEMENT_PLAN_GENERATED`, `OPPORTUNITY_SELECTED`, `PLACEMENT_*` events etc.

## Determinism

Everything is deterministic: fixed seed data, the `ScenarioAIProvider` (no real LLM)
and the stateful `MockPlacementProvider`. Re-running `pnpm demo` produces the same
transcript; the placement plan regenerates identically (verified by the E2E suite).

## Real modes

`pnpm start` (and `AI_MODE=real DISCOVERY_MODE=real pnpm start`) boot the same flow
through the API; see README.md "Real AI and web discovery".

## UI

`pnpm start` serves the built web UI at http://localhost:8787 (or `pnpm dev:web` on
:5173 + `pnpm dev:api` on :8787). The «План размещений» screen (`/plans`) shows the
generated plan: stat cards, "С чего начать" (recommended first actions) and per-item
decision rows with reasons, anchor, risk and approach subtext.
