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

Uses browser automation where permitted and technically appropriate.

### Manual Provider

Produces a structured task for a human.

### Mock Provider

Used for prototype development and tests.

The mock is deterministic and stateful per placement:

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

### Demo/production policy

Provider selection itself is pure domain logic and never reads the
environment. The demo/test composition binds `MockPlacementProvider`
implementations and allows MOCK provider records; the production
composition passes `allowMocks: false` to the provider registry, which
excludes MOCK records from listing and resolution — a MOCK provider can
never be selected in production.

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

## API cost

Paid APIs are acceptable if required for production integration.

The prototype should not require paid credentials to demonstrate the core workflow. Use MockProvider where credentials are unavailable.

## Link-building intelligence port interfaces

### SeoMetricsProvider

Real SEO intelligence for donor quality (Ahrefs / Semrush / Similarweb /
Google Search Console). Returns a `SeoMetricsSnapshot` with organic traffic,
traffic geography, keyword profile, backlink profile, authority, spam risk,
indexation and estimated real traffic — each as a `MetricDatum` carrying
`status`, `source`, `confidence` and `measuredAt`.

Real implementations return `MEASURED`; the demo mock (`ScenarioSeoMetricsProvider`)
returns `SYNTHETIC` data with `source: "demo"`. The status field keeps the
distinction visible — the UI never presents synthetic values as real
measurements.

### PageAnalysisProvider

A crawler that returns real page-level signals (title, page type, indexation,
outbound links, topical relevance, link-insert suitability, suggested
placement location). Demo mock returns curated synthetic pages for the demo
editorial platforms and a deterministic profile fallback.

### OutreachProvider (messaging/email)

`send({ to, subject, body })` returns `{ externalId, sentAt }`. It is invoked
**only** from the explicit human-triggered `APPROVED → SENT` transition — never
automatically. The demo mock returns a deterministic id.

## Real-data vs demo-data policy

Never present demo/mock SEO metrics as real measurements. Every external metric
has a `status`: `MEASURED` (real tool), `AI_ESTIMATED` (with confidence),
`INTERNAL` (deterministic), `SYNTHETIC` (demo) or `UNKNOWN`. The UI renders the
status so users can immediately tell real data from demo estimates.

## Security

Provider credentials:
- server-side only
- environment variables
- never committed
- never exposed in frontend bundles
