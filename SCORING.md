# Placement Scoring

## Purpose

Provide a transparent and reproducible prioritization mechanism.

The LLM may provide semantic judgments, but the final score is calculated deterministically.

## Initial weights

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
