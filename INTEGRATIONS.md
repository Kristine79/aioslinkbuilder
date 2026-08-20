# Integrations

## Integration principles

Never invent provider capabilities.

Separate:

- discovery
- validation
- create
- update
- status
- verification

A provider may support only some of these.

## Provider capability model

Canonical capability names (aligned with ARCHITECTURE.md and the PRD):

```text
discover
validate
create
update
getStatus
verify
```

Example:

```text
Provider: ExampleDirectory

discover: true
validate: true
create: false
update: false
getStatus: false
verify: true
```

## Provider types

### API Provider

Uses an official or authorized API.

### Browser Provider

Uses browser automation where permitted and technically appropriate. The
browser type itself does not guarantee that a working client exists — the
`capabilitiesVerified` flag decides what may be executed.

### Manual Provider

Produces a structured task for a human. Reaches `PUBLISHED` only when the
human provides proof (external reference + public URL).

### Mock Provider

**Demo/test only.** Used for prototype development and tests. The mock is
deterministic and stateful per placement:

- `create()` reports the first status of the configured timeline
  (`alwaysPublish: true` is the fast mode and publishes immediately).
- `getStatus()` advances the placement one step per poll along the
  timeline; the last status is terminal. Supported statuses:
  `pending_moderation`, `pending_publication`, `processing`, `published`,
  `failed`, `rejected`, `needs_manual`, `blocked`.
- `failCreate: true` (or `failCreate: <number>`) simulates create failures;
  a number fails only the first N attempts so the FAILED -> retry path is
  demonstrable.
- `failVerify: true` simulates a platform that cannot confirm the result.

Mock execution produces **synthetic** external ids and live URLs
(`https://mock.example/...`). A mock placement is never a real external
publication and must never be presented as one.

## Demo/production policy

Provider selection itself is pure domain logic and never reads the
environment. The demo/test composition enables MOCK providers; the
production composition denies them by default (ADR-015). The switch is a
single runtime flag — `MOCK_PROVIDERS` — parsed at startup by the delivery
API (`apps/api/src/runtime-config.ts`):

- `MOCK_PROVIDERS=deny` (default) — the registry gates MOCK records out of
  listing and resolution (`ProviderUnavailableError`), so a MOCK provider
  can never be selected for automated execution. MANUAL providers stay
  listed, but no synthetic implementation is bound in deny mode: requesting
  one fails loudly instead of fabricating verification results.
- `MOCK_PROVIDERS=allow` — demo/test/preview only: binds
  `MockPlacementProvider` implementations so the full placement lifecycle
  can be demonstrated.
- Any unrecognized value fails startup — the product never silently enables
  mocks.

The flag is checked at the composition boundary only
(`buildRegistry(providers, allowMockProviders)` in
`apps/api/src/prisma-environment.ts`); the domain and application layers are
unaware of it.

## Initial real-world provider research

The prototype may contain platform records for:

- Яндекс Бизнес
- 2ГИС
- Мебель.ру
- Мебель от фабрик
- INMYROOM
- SALON-interior
- Design Mate
- Archi.ru
- Houzz
- selected media
- VK
- Telegram
- YouTube
- Дзен
- Pinterest

These are candidate opportunities, not claims that every platform supports automated publication.

For every real platform, document the verified capability before implementing it.

## Placement execution — what actually runs today

`PlacementProvider` (`packages/integrations/src/contracts/placement-provider.ts`)
is the abstraction every platform integration implements. Provider alignment
is deterministic domain logic (`selectBestProvider`): verified providers that
support `CREATE`+`VERIFY` win by type priority (`API > MOCK > BROWSER >
MANUAL`).

**No real placement provider is implemented.** The catalog only contains:

- `MOCK` provider records (YandexBusiness Mock, TwoGIS Mock, MebelRu Mock,
  ArchiRu Mock, Zoon/Flamp/DivanRu/DesignMate/Roomble/Archspeech/ProfiRu
  mocks) — executable only in demo/test composition (`MOCK_PROVIDERS=allow`),
  synthetic by design;
- a `MANUAL` provider record (INMYROOM) — the human-in-the-loop path;
- a `BROWSER` candidate record (VK) with `capabilitiesVerified: false` — it
  is **not** executable and claims no capability.

Therefore, in the production composition, **no automated external placement
occurs**. The only exit to `PUBLISHED` is the manual flow (human-in-the-loop
with proof), and even that requires a human operator performing the action
outside the system. Real external publication will exist only when a real
platform adapter is implemented and configured behind the same contract.

## AI

### OpenCodeAIProvider (real)

`OpenCodeAIProvider` (`packages/ai/src/providers/opencode-ai-provider.ts`) is
the **real LLM integration**, enabled by `AI_MODE=real`. It calls an
OpenCode-compatible chat-completions endpoint (`OPENCODE_BASE_URL`, default
`https://opencode.ai/zen/go/v1`) with the configured model
(`OPENCODE_MODEL`, default `deepseek-v4-pro`).

- Every AI task returns JSON that is **zod-validated** before it can
  influence business state; malformed responses get one corrective retry,
  then a hard error.
- Transport errors map to typed errors (auth / rate-limit / timeout / network
  / server): 401 → no retry and no key leakage; 429/5xx → bounded retries
  with backoff; per-request timeout.
- In real mode the `SeoMetricsProvider` is `null`, so SEO metrics stay
  `UNKNOWN` (honest "no data") — real mode never invents measurements.
- Real mode without `OPENCODE_API_KEY` is a startup error
  (`RuntimeConfigError`) — no silent fallback to demo.

### ScenarioAIProvider (demo)

The demo composition uses the deterministic `ScenarioAIProvider`
(`apps/api/src/scenario/nordhaus-fixtures.ts`). It **does not call any LLM**;
it returns fixed scenario outputs so the demo/E2E are reproducible. A UI
label makes the provider visible; it must never be mistaken for a real model
call.

## Web discovery

Discovery is provider-based through the `WebSearchProvider` abstraction; the
discovery pipeline (`WebSearchPlatformDiscoverySource`) plans search intents
(via `AIBackedSearchQueryGenerator` or a deterministic fallback), asks a real
search backend, normalizes/dedupes results, and persists brand-new sites into
the platform catalog (`discoveredVia: "web-search"`).

Discovery context comes from the campaign's **strategy directions**:
`DiscoverySourceInput.strategyDirections` carries both catalog-backed
(`categoryId` set) and AI-derived (`categoryId === null`) directions, and the
intent generator receives their codes as `relevantCategoryCodes` (the
`availableCategoryCodes` list always stays the catalog). The discovery use
case only filters candidates by codes that actually exist in the catalog —
a company whose AI analysis names topics outside the catalog still gets real
web discovery instead of a silently empty result.

### DuckDuckGoHTML

`DuckDuckGoSearchProvider` (default, `DISCOVERY_PROVIDER=duckduckgo`) is a
real web-search integration over DuckDuckGo's server-rendered HTML endpoint
(no API key). It returns **real external URLs**; it never fabricates results,
and failures (timeout / HTTP / rate-limit / empty page) surface as
`ProviderError` instead of fake data.

It is a working integration, but it is a scrape of a consumer search page
(not an official search API), so it is best treated as a prototype/auxiliary
backend rather than a contracted production search vendor.

### Search-capable AI provider

`AISearchCitationsProvider` (`DISCOVERY_PROVIDER=ai-search`) uses a
search-capable AI endpoint (e.g. `perplexity/*` or `sonar` on OpenRouter)
whose **real citations** (`message.annotations[].url_citation`) become the
search results. Configuration:

- `AI_SEARCH_API_KEY` — required; the OpenCode Go key is a plain LLM endpoint
  and cannot be reused for web search.
- `AI_SEARCH_BASE_URL` / `AI_SEARCH_MODEL` — endpoint + model.
- `AI_SEARCH_CAPABILITIES` — must declare `web_search,citations` (capabilities
  are never guessed from a model name); wrong/missing capabilities fail
  startup.
- `AI_SEARCH_TIMEOUT_MS` — default `45000`.

A call that returns zero citations is an explicit error — an LLM answer
without real citations is never treated as discovered sites.

### Discovery run state

Every discovery attempt (whichever provider backs it) persists a per-campaign
`DiscoveryRun`: RUNNING while in flight, then exactly one terminal state —
COMPLETED_WITH_RESULTS, COMPLETED_EMPTY, or FAILED (a source/provider error is
never reported as an empty result). The run carries metadata (lastRunAt,
discovered/classified counts, which sources produced candidates, failure
message) and is served at `GET /api/discovery-state`. The UI reads that state
instead of sessionStorage so outcomes survive a refresh.

### Which discovery provider is production-ready?

Neither backend is a paid, contracted search vendor. Both are real, working,
credential-scoped integrations; their production robustness should be re-
validated when the product moves to heavy/real use. Requests are
latency-bounded by `DISCOVERY_MAX_QUERIES` / `DISCOVERY_MAX_RESULTS_PER_QUERY`
/ `DISCOVERY_MAX_CANDIDATES` / `DISCOVERY_CONCURRENCY` (serverless-safe
defaults).

## Page analysis

- **Real**: `HttpPageAnalysisProvider` (enabled with `AI_MODE=real`) fetches
  the page over HTTP and measures what it can — title, canonical, page type,
  indexation (from robots/headers), outbound-link signals — each `MEASURED`
  with source `http`. Everything that cannot be measured stays `UNKNOWN`;
  fetches that fail (timeout, non-HTML, HTTP error) return an `UNKNOWN`
  analysis instead of invented data.
- **Demo**: `ScenarioPageAnalysisProvider` returns curated synthetic pages for
  the demo scenario (`SYNTHETIC`, source `demo`) and a deterministic profile
  fallback.

## SEO metrics

`SeoMetricsProvider` is the port for real SEO intelligence (Ahrefs / Semrush /
Similarweb / Google Search Console). **No real implementation exists yet** and
no paid credentials are configured; `seoMetrics` is `null` in real mode, so
every metric degrades honestly to `UNKNOWN`. The demo mock
(`ScenarioSeoMetricsProvider`) returns `SYNTHETIC` data with source `demo`.

Never present `SYNTHETIC` or `AI_ESTIMATED` values as real external SEO data.

## Outreach (messaging/email)

`OutreachProvider.send({ to, subject, body })` returns `{ externalId, sentAt }`
and is invoked **only** from the explicit human-triggered `APPROVED → SENT`
transition — never automatically. **No real email/messaging integration is
implemented**: the production composition also binds the scenario
(`ScenarioOutreachProvider`) implementation, which returns a deterministic
synthetic id. Real delivery requires a real provider behind this port.

## Placement plan (decision engine)

The AI placement plan (ADR-013) introduces **no new integrations and no new
provider capabilities**: it reads provider availability through the existing
registry (`selectBestProvider`) with the same capability model (`CREATE` +
`VERIFY` for automatic execution, `VERIFY`-only for manual, `OUTREACH` always
available) and calls the existing AI provider abstraction
(`generatePlacementPlan`). A platform without a verified `CREATE` capability
yields `REVIEW_REQUIRED` / manual handling — never a fabricated automatic
step.

## Provenance

Every external metric (and every analytic value) carries explicit provenance.
This is the vocabulary used by the domain, the API and the UI:

| Status | Meaning |
| --- | --- |
| `MEASURED` | measured by a real external tool or real HTTP probe |
| `AI_ESTIMATED` | estimated by AI from available context, with a confidence |
| `INTERNAL` | derived deterministically inside the system |
| `SYNTHETIC` | demo/mock data — never a real measurement |
| `UNKNOWN` | not available — never fabricated |

The UI renders the status (e.g. `измерено` / `оценка AI` / `демо-данные` /
`нет данных`) so users can immediately tell real data from demo estimates.
`UNKNOWN` is preferable to fabricated data anywhere the doc or code says
"unknown".

## Real mode environment variables

The demo runs fully deterministically by default (`ScenarioAIProvider`, the
synthetic search source and mock SEO/page providers). Real modes are enabled
explicitly through environment variables — never silently:

| Option | Values | Default | Effect |
| --- | --- | --- | --- |
| `AI_MODE` | `real` / `demo` | `demo` | `real` uses `OpenCodeAIProvider` for every AI capability and `HttpPageAnalysisProvider` for page analysis; `SeoMetricsProvider` is null (metrics stay `UNKNOWN`). |
| `DISCOVERY_MODE` | `real` / `demo` | `demo` | `real` replaces the discovery sources with `WebSearchPlatformDiscoverySource`; found sites are persisted into the platform catalog (ADR-012). |
| `DISCOVERY_PROVIDER` | `duckduckgo` / `ai-search` | `duckduckgo` | The real web-search backend used when `DISCOVERY_MODE=real`. `ai-search` requires `AI_SEARCH_*` below. |
| `OPENCODE_API_KEY` | — | — | Required by `AI_MODE=real` / `DISCOVERY_MODE=real`; missing is a startup error (`RuntimeConfigError`). |
| `OPENCODE_BASE_URL` | — | `https://opencode.ai/zen/go/v1` | OpenCode Go endpoint. |
| `OPENCODE_MODEL` | — | `deepseek-v4-pro` | Chat-completions model. |
| `OPENCODE_TIMEOUT_MS` | — | `30000` | Per-request AI timeout. |
| `AI_SEARCH_API_KEY` | — | — | Required by `DISCOVERY_PROVIDER=ai-search`. |
| `AI_SEARCH_BASE_URL` / `AI_SEARCH_MODEL` | — | default endpoint/model | Search-capable AI provider endpoint. |
| `AI_SEARCH_CAPABILITIES` | e.g. `web_search,citations,usage` | — | Declared endpoint capabilities; required and validated at startup. |
| `AI_SEARCH_TIMEOUT_MS` | — | `45000` | Per-request timeout. |
| `MOCK_PROVIDERS` | `allow` / `deny` | `deny` | `allow` binds MOCK placement providers (demo/test/preview only). |
| `DISCOVERY_MAX_*` / `DISCOVERY_CONCURRENCY` | positive ints | bounded defaults | Cost/latency caps for real web discovery. |

Real-mode data guarantees:

- AI output passes zod validation before touching domain state.
- Search results are real external URLs; the discovery source never
  fabricates platforms; a brand-new site is created with
  `discoveredVia: "web-search"` metadata.
- All-query failure surfaces as `DiscoverySearchFailedError` (HTTP 502) —
  real data is never replaced with fake results.
- Provenance labels: `web-search` discovery source, `OpenCode Go` AI provider,
  `http-page-analysis` page analysis, `нет данных` for unmeasured SEO.

> Note: `DISCOVERY_PROVIDER` / `AI_SEARCH_*` are documented in `.env.example`
> with placeholders — fill them only with real (never committed) values.

## Security

Provider credentials:
- server-side only
- environment variables
- never committed
- never exposed in frontend bundles

Errors never include the API key; the client sends it only in the
`Authorization` header and maps failures to status/category-specific messages.
