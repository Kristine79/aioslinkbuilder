# E2E tests

Scaffold for the end-to-end test suite (Phase 6).

Minimum happy path per TESTING.md:

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

E2E tests run against the real PostgreSQL database with the MockProvider
and a mocked AI provider. They are intentionally not implemented in
Phase 0 (no UI exists yet).