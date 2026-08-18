# E2E tests

End-to-end suite (Phase 6): `tests/e2e/nordhaus-flow.test.ts`.

Boots the real production composition — `createServerApp` from `apps/api`
(API routes + static UI serving with SPA fallback) — over real HTTP on an
ephemeral port, then drives the complete Nordhaus journey the way the UI
does:

```text
Create Campaign
→ Analyze Company
→ Discover Opportunities
→ Score
→ Select
→ Approve
→ Mock Placement
→ Verify
```

Covered in addition to the happy path:

- monitoring a submission through publication and verification
- retry after a failed attempt (fresh placement record, audit trail intact)
- the manual (human-in-the-loop) path with proof requirements
- invalid state transitions → 409 INVALID_STATE
- validation failures → 400 VALIDATION
- missing resources → 404 NOT_FOUND
- server-side filters and company re-analysis
- the activity feed accumulating the whole journey
- static UI serving and SPA fallback (when `apps/web/dist` exists)

Deterministic: in-memory repositories, MockProvider, fixture AI provider.
No database, no external services.

```bash
pnpm build:web   # once, to exercise static serving
pnpm test:e2e
```
