# Project Status

Classification of every capability in the AI OS Link Building Module.
Statuses:

- **IMPLEMENTED** — real, production-grade logic (works identically with real and mock data).
- **MOCK** — implemented against the MockProvider / demo composition only.
- **DEMO** — demonstrated deterministically (in-memory / ScenarioAIProvider).
- **INTERFACE_ONLY** — port defined, no real implementation.
- **NOT_IMPLEMENTED** — explicitly out of scope.

## Pipeline

| Capability                          | Status                                                                      | Where                                             |
| ----------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| Company / Campaign CRUD             | IMPLEMENTED                                                                 | domain + application use cases                    |
| AnalyzeCompany (AI)                 | IMPLEMENTED (real AI in `AI_MODE=real`)                                     | AI provider + validated schema                    |
| Placement strategy                  | IMPLEMENTED                                                                 | domain strategy logic                             |
| Opportunity discovery (catalog)     | IMPLEMENTED                                                                 | discovery sources                                 |
| Web-search discovery (DuckDuckGo)   | IMPLEMENTED                                                                 | `DISCOVERY_MODE=real`                             |
| Ahrefs / Semrush / Similarweb / GSC | INTERFACE_ONLY                                                              | `SeoMetricsProvider` port                         |
| Page analysis (real HTTP crawler)   | IMPLEMENTED                                                                 | `http-page-analysis` (real in `AI_MODE=real`)     |
| Classification + Score 1.0          | IMPLEMENTED                                                                 | deterministic                                     |
| Donor quality / Score 2.0 / risk    | IMPLEMENTED (deterministic; AI estimates in real mode)                      | intel on opportunity metadata                     |
| Link insert / anchor assistant      | DEMO (ScenarioAIProvider), IMPLEMENTED in real mode                         | AI methods + validated schemas                    |
| Outreach assistant + HITL sending   | IMPLEMENTED                                                                 | domain transitions + OutreachProvider port        |
| Negotiation copilot (HITL)          | DEMO (Scenario) / interface for real                                        | AI method + human approve/send                    |
| **AI placement plan**               | **IMPLEMENTED** (deterministic engine + AI interpretation + reconciliation) | domain + application + API + UI                   |
| Execution (MockProvider)            | MOCK                                                                        | `MockPlacementProvider`, stateful & deterministic |
| Execution (real platform)           | NOT_IMPLEMENTED                                                             | no real platform integration shipped              |
| Monitoring (MockProvider timeline)  | MOCK                                                                        | `getStatus` stateful advance                      |
| Verification + evidence             | MOCK (MockProvider) / IMPLEMENTED flow                                      | domain verification + evidence types              |
| Audit log                           | IMPLEMENTED                                                                 | immutable events, actor system/human              |
| Human-in-the-loop workspace         | IMPLEMENTED                                                                 | `deriveHumanActions` + UI                         |

## Delivery

| Component                                    | Status                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Rest API (Hono) + error mapping              | IMPLEMENTED                                                                                      |
| Russian web UI (React + Vite)                | IMPLEMENTED                                                                                      |
| Vercel deployment (API function + static UI) | IMPLEMENTED (see README deployment notes)                                                        |
| Neon PostgreSQL persistence                  | IMPLEMENTED (Prisma) — **DB currently unreachable from local network; migrations pending apply** |
| Real SEO metrics (Ahrefs/Semrush/Similarweb) | INTERFACE_ONLY (needs paid credentials)                                                          |
| Queue / background jobs                      | NOT_IMPLEMENTED (out of scope, see ADR-013)                                                      |
| Email/billing                                | NOT_IMPLEMENTED (out of scope)                                                                   |

## Current known limitations

- Local network cannot reach Neon (verified repeatedly), so integration tests and
  `prisma migrate dev` fail locally; `pnpm db:generate` works. Apply migrations from
  Vercel/CI (or VPN) — see ADR-008.
- Real provider adapters (Yandex Business API, 2GIS API, etc.) are not implemented;
  every real platform capability is documented before implementation (INTEGRATIONS.md).
- Real-mode SEO metrics degrade honestly to `UNKNOWN` without paid credentials.
