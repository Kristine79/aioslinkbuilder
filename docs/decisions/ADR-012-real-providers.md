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
   returns real results → results are normalized and deduped → brand-new
   sites are persisted via a new `LookupRepository.createPlatform`
   (ADR-010: persist-then-return platformId) → candidates flow into the
   unchanged discovery use case. The real `WebSearchProvider` backend is
   selected by `DISCOVERY_PROVIDER`:
   - `duckduckgo` (default) — `DuckDuckGoSearchProvider` (HTML search, no
     API key);
   - `ai-search` — `AISearchCitationsProvider`, which adapts a
     search-capable AI endpoint (e.g. `perplexity/*`/`sonar` on OpenRouter)
     whose real citations become search results. It requires
     `AI_SEARCH_API_KEY` + `AI_SEARCH_CAPABILITIES` (must declare
     `web_search,citations`; capabilities are never guessed from a model
     name); missing/insufficient configuration is a startup error. A call
     with zero citations is an explicit `ProviderError` — an LLM answer
     without real citations is never treated as discovered sites.
     Both backends are real integrations returning real external URLs; the
     discovery pipeline is backend-agnostic.
3. Both real modes require `OPENCODE_API_KEY`. `AI_MODE=real` or
   `DISCOVERY_MODE=real` without the key is a startup error
   (`RuntimeConfigError`), never a silent fallback to demo data.
   `DISCOVERY_PROVIDER=ai-search` additionally requires its own
   `AI_SEARCH_*` credentials (the OpenCode Go key is a plain LLM endpoint
   and cannot be reused for web search).

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
- The `ai-search` backend is an adapter over a search-capable AI provider,
  not a new discovery architecture: it implements the existing
  `WebSearchProvider` port, so downstream pipeline (dedupe, persist-then-
  return, candidate caps) is unchanged. Its provenance label is `ai-search`.
- `PrismaLookupRepository.createPlatform` is idempotent by normalized URL,
  matching the in-memory repository; a brand-new web-discovered platform gets
  stable deterministic ids (`platform-ws-<domain>-<hash>`) and metadata
  `discoveredVia: "web-search"`.
- Docs/UI: `.env.example`, README, INTEGRATIONS.md, `apps/web/src/ru.ts`
  labels updated; no creds in git, logs, errors or frontend bundles.
