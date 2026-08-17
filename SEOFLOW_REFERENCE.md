# SEOFlow Reference

Repository:
https://github.com/Kristine79/seoflowai

SEOFlow is a reference for domain knowledge and previously validated workflow ideas.

## Concepts worth reusing

- explicit placement/submission statuses
- `SUBMITTED` is different from successful verification
- evidence-based verification
- human-in-the-loop workflows
- blocked/manual states
- platform analysis
- scoring
- AI + deterministic rules
- monitoring
- retry/re-probe concepts

## Concepts to improve

The new module must avoid reproducing SEOFlow's evolutionary architecture, including:
- JSON files as operational source of truth
- legacy scripts as core business logic
- mixed automation implementations
- duplicated operational state
- provider-specific conditionals in business logic

## Rule

Do not copy SEOFlow code, database schema, dependencies, or implementation patterns.

Use it only to understand the problem domain and previously learned lessons.

The new project must remain fully standalone.
