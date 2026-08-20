# Limitations

This module is a working prototype with a production-oriented architecture.
This document separates **what is real**, **what is demonstrated**, and
**what is not implemented yet**. It is intentionally conservative: do not
assume a capability is "real" unless this document (or the current code) says
so explicitly.

## Not included yet

- authentication / authorization / multi-tenancy (no user model exists)
- billing
- mass real-world submissions at scale
- production-scale scraping / unrestricted browser automation
- a full outreach CRM
- a full SEO analytics platform
- automated link purchasing
- a background job/queue system
- complex multi-agent orchestration

## Demo vs. production execution

There are two distinct execution environments:

| Environment | Composition | Placement execution |
| --- | --- | --- |
| Demo / test (`pnpm demo`, E2E, unit fixtures, `MOCK_PROVIDERS=allow`) | `MockPlacementProvider` is bound and usable | placements run against a deterministic simulator; results are synthetic |
| Production (`pnpm start` / Vercel, `MOCK_PROVIDERS=deny` default) | MOCK providers are excluded by the provider registry | automated execution against a synthetic provider is impossible |

Key rules:

- **MockProvider exists to demonstrate the complete workflow without real
  external side effects.** It returns synthetic external ids and live URLs
  (`https://mock.example/...`) and never claims a real external API exists.
- The default production composition **excludes MOCK providers**
  (`MOCK_PROVIDERS=deny`, ADR-015). A mock placement can never be selected
  for automated execution in production.
- A synthetic/mock placement must **never be presented as a real external
  backlink**. UI provenance labels keep the distinction visible.
- Real placement execution requires a real provider/integration. **No real
  platform integration (Yandex Business API, 2GIS API, editorial, etc.) is
  implemented yet** — only MOCK, MANUAL (human-in-the-loop) and unverified
  BROWSER candidate records exist in the dataset.

## Synthetic company

Nordhaus is fictional demo data (a synthetic company seeded for the demo
campaign) and must never be represented as a real client. The same demo
company is upserted by `pnpm db:seed`, so it may exist in the database; it is
labeled synthetic in the seed data.

## External platforms

Platform records are research data. **A platform being listed in the dataset
does not mean that real automated publication is supported.** API capabilities
must be verified before any real integration is implemented.

## Real integrations (what exists today)

- **Real AI**: `OpenCodeAIProvider` when `AI_MODE=real` (requires
  `OPENCODE_API_KEY`; fails fast without it). In demo mode AI is the
  deterministic `ScenarioAIProvider`.
- **Real web discovery**: `WebSearchPlatformDiscoverySource` when
  `DISCOVERY_MODE=real`, over DuckDuckGo (default) or a search-capable AI
  provider (`DISCOVERY_PROVIDER=ai-search`). Requires credentials; provider
  failures are loud, never silently replaced with fake results.
- **Real page analysis**: `HttpPageAnalysisProvider` (real HTTP fetch) when
  `AI_MODE=real`.
- **SEO metrics**: no real source (Ahrefs/Semrush/Similarweb/GSC) is
  configured; metrics degrade honestly to `UNKNOWN` instead of being
  fabricated (`SYNTHETIC` is demo data only).
- **Outreach/messaging**: only a scenario (synthetic) `OutreachProvider`
  exists; no real email/messaging integration is implemented. Sending is
  human-triggered regardless.

## Scope of this document

This document does not attempt to hide implementation gaps in footnotes. If a
capability described elsewhere in the documentation appears "automated" or
"real", check this document and `docs/PRODUCTION_READINESS.md` for the actual
state.
