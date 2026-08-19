# Placement Scoring

## Purpose

Provide a transparent and reproducible prioritization mechanism.

The LLM may provide semantic judgments, but the final score is calculated deterministically.

## Initial weights (Score 1.0)

| Dimension | Weight |
|---|---:|
| Topical relevance | 30% |
| Audience match | 20% |
| Geographic relevance | 15% |
| Authority | 15% |
| Placement quality | 10% |
| Automation potential | 10% |

Total: 100%.

## Score range

0–100.

## Score breakdown

Store each component separately:

```text
topicalRelevance
audienceMatch
geographicRelevance
authority
placementQuality
automationPotential
total
```

## AI responsibility

AI may:
- classify topical relevance
- explain audience fit
- classify placement type
- identify relevant topics
- provide semantic evidence

AI must not:
- directly persist the final score
- bypass deterministic weighting
- change score weights

## Explainability

Every opportunity should have a human-readable `whyRecommended` explanation.

The explanation must be grounded in the structured analysis rather than generic marketing copy.

---

## Opportunity Score 2.0

Score 1.0 remains the single source of truth for the base opportunity score. Score 2.0 is an extension view that separates five dimensions and combines them into one overall number. It is entirely deterministic and documented below.

### Dimensions and weights

| Dimension | Weight | Source |
|---|---:|---|
| Relevance score | 30% | weighted topical/audience/geographic from Score 1.0 (55/30/15 relative) |
| Donor quality score | 25% | donor quality profile (deterministic, see below) |
| Placement quality score | 20% | Score 1.0 placement quality, blended with page link-insert suitability when available |
| Execution score | 15% | Score 1.0 automation potential adjusted by execution method |
| Risk score | 10% | inverse of the deterministic donor risk level |

Total: 100%. Overall = round(weighted average).

### Execution adjustment

| Method | Adjustment |
|---|---:|
| API / SEMI_AUTOMATED | 0 |
| BROWSER | −5 |
| OUTREACH | −10 |
| MANUAL | −15 |
| UNKNOWN | −20 |

### Risk score mapping

| Risk level | Risk score |
|---|---:|
| LOW | 90 |
| MEDIUM | 60 |
| HIGH | 30 |
| UNKNOWN | 50 |

AI supplies semantic dimensions (relevance inputs, donor estimates, risk context). AI never writes the final numeric score.

---

## Donor quality score

The donor quality overall score is the weighted average of all *known* (non-UNKNOWN) dimensions, re-normalized over the known weights. Unknown dimensions are neither rewarded nor penalized.

| Dimension | Weight |
|---|---:|
| Topical relevance | 20% |
| Authority (DR/DA-like) | 20% |
| Audience match | 15% |
| Geographic relevance | 10% |
| Organic traffic | 10% |
| Backlink profile | 10% |
| Placement quality | 5% |
| Automation potential | 5% |
| Estimated real traffic | 5% |

Raw traffic counts are normalized to a 0–100 scale with diminishing returns; backlinks use a logarithmic scale. The overall level is derived from the score: ≥80 EXCELLENT, ≥65 GOOD, ≥50 FAIR, else POOR, and UNKNOWN when nothing is known.

### Metrics provenance

Every external metric carries explicit provenance that the UI must respect:

- `MEASURED` — real external tool (Ahrefs, Semrush, Similarweb, GSC)
- `AI_ESTIMATED` — estimated by AI, with a confidence
- `INTERNAL` — derived deterministically inside the system
- `SYNTHETIC` — demo/mock data (never presented as real)
- `UNKNOWN` — not available

## Donor risk

Risk is computed deterministically from available signals (severity 1–3):

| Signal | Default severity |
|---|---:|
| Link selling / high spam-risk | 1–3 |
| Poor indexation (NOT_INDEXED / PARTIAL) | 3 / 1 |
| Irrelevant topical profile | 1–2 |
| Traffic/authority mismatch | 2 |

Level: 0 severity LOW, 1–2 MEDIUM, 3+ HIGH, no signals UNKNOWN.

---

## Placement plan thresholds (decision engine)

The AI placement plan ("План размещений", ADR-013) interprets the deterministic
signals into a per-opportunity decision. The recommendation thresholds are domain
constants (`packages/domain/src/placement-plan.ts`):

| Bucket | Condition |
|---|---|
| `RECOMMENDED` | effective score ≥ 75 and no high-risk blocker |
| `REVIEW_REQUIRED` | effective score 55–74, or HIGH risk, or no verified CREATE provider for an automatic execution |
| `NOT_RECOMMENDED` | effective score < 55, or insufficient data, or explicit low-score rejection |

Notes:

- Effective score = the deterministic opportunity score when `intel` is absent,
  or the average of the opportunity score and `intel.scoreV2.overall` when both exist.
  The AI never writes the numeric scores used here.
- The AI may *suggest* a bucket, but `reconcilePlanDecision` re-derives the final
  bucket/action/automation from the current scores — an over-optimistic AI cannot
  promote a low-scoring opportunity.
- Under-score reasons are preserved as context when the AI suggestion is kept.
- The summary automation percentage is deterministic:
  `(AUTOMATIC × 1 + AI_ASSISTED × 0.5) / total`, rounded.
