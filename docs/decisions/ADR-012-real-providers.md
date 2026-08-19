# ADR-012: Real AI Provider and Web Discovery Modes

Status: accepted
Date: 2026-08-19
Context: ADR-002 (AI vs deterministic logic), ADR-010 (discovery sources),
ADR-011 (link-building intelligence)

## Decision

The deterministic demo mode stays the default; real integrations are opt-in
via environment variables and are never silently substituted for demo data.

1. `AI_MODE=real` wires `OpenCodeAIProvider` (OpenCode Go chat completions,
   OpenAI-compatible, default model `deepseek-v4-pro`) behind the existing
   `AIProvider` port and `HttpPageAnalysisProvider` behind
   `PageAnalysisProvider`. There is no real SEO metrics source yet: the
   `SeoMetricsProvider` is `null`, so every metric stays `UNKNOWN` — honest
   "no data" instead of synthetic values.
2. `DISCOVERY_MODE=real` replaces the scenario discovery sources with
   `WebSearchPlatformDiscoverySource` (application layer):
   `SearchQueryGenerator` (LLM-backed `AIBackedSearchQueryGenerator` or
   deterministic fallback) plans search intents → `WebSearchProvider`
   (`DuckDuckGoSearchProvider`) returns real results → results are normalized
   and deduped → brand-new sites are persisted via a new
   `LookupRepository.createPlatform` (ADR-010: persist-then-return
   platformId) → candidates flow into the unchanged discovery use case.
3. Both real modes require `OPENCODE_API_KEY`. `AI_MODE=real` or
   `DISCOVERY_MODE=real` without the key is a startup error
   (`RuntimeConfigError`), never a silent fallback to demo data.

## Consequences

- The AI boundary is unchanged: AI output is zod-validated
  (`validateAIOutput`) before any domain mutation; LLMs never compute final
  deterministic scores and never write domain state directly.
- The driving rule stays truthful provenance: `web-search` discovery source,
  `OpenCode Go` AI provider label, `http-page-analysis` page analysis,
  `MEASURED` only for real measurements, `UNKNOWN` otherwise.
- Cost/robustness protections: per-request timeout, exactly two retries with
  exponential backoff for 429/5xx/network/timeout, one corrective retry for
  malformed JSON (then a hard error), query/result/candidate caps, bounded
  search concurrency, dedupe by normalized URL.
- `AiProvider` gains one capability (`generateSearchQueries`); all
  implementations (real, scenario, test stubs) implement it.
- `PrismaLookupRepository.createPlatform` is idempotent by normalized URL,
  matching the in-memory repository; a brand-new web-discovered platform gets
  stable deterministic ids (`platform-ws-<domain>-<hash>`) and metadata
  `discoveredVia: "web-search"`.
- Docs/UI: `.env.example`, README, INTEGRATIONS.md, `apps/web/src/ru.ts`
  labels updated; no creds in git, logs, errors or frontend bundles.
