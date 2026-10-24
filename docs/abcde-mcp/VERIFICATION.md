# Verification record

Checked in the development workspace on 2026-10-24. No production deployment was performed.

## Passed

- Full pnpm workspace TypeScript checks.
- Production landing-page build and API service build/start.
- Twenty automated domain and network-resilience tests:
  - strict parsing, missing/null/zero values, unchanged original names, safe URL/photo fallbacks;
  - store and nutrient filtering, unknown nutrient bases, compact summaries;
  - store-qualified duplicate basket entries, package limits, gram/kilogram calculations, unresolved items, 113.01 g fixture;
  - 404, 429/Retry-After, 5xx, transient network errors, timeouts, cancellation;
  - malformed/non-JSON and oversized upstream responses;
  - concurrency, paced request starts, bounded queue, queued cancellation, and shared-budget failure.
- Official MCP TypeScript client through the proxy `/mcp` route:
  - legacy initialization and modern automatic protocol negotiation;
  - exactly three read-only tools and advertised output-schema validation;
  - live details for Rimi 3975 and Maxima 7451;
  - repeated product call, filtered Rimi search, strict Maxima protein filter, and browse without text;
  - live duplicate-combined basket: 113.01 g protein; Nutri-Score B × 2, D × 1;
  - partial basket, missing product, all-failed basket, duplicate combined-quantity rejection.
- All eleven actual protocol-test tool attempts were reflected in the public aggregate counter, including the repeated call and failed tools.
- Aggregate counters persisted through an API process restart.
- `/health` reports storage availability; `/mcp` does not return landing-page HTML.
- Untrusted Host/Origin rejection, malformed MCP JSON, and oversized MCP request rejection.
- Desktop and 390 px mobile page captures render correctly without fresh browser errors. The unpublished endpoint remains unavailable for copying.

## Not yet verified

- The eventual published URL and production routing/migrations.
- A real Claude account adding and using the connector.
- Multi-instance stress/load behavior, cache-eviction pressure, and quota-boundary contention under production traffic. The application uses atomic PostgreSQL shared buckets, but the development checks are not a multi-instance load test.
- Manual screen-reader/keyboard and real-browser clipboard testing. Copy controls and live status announcements are implemented; screenshots do not verify clipboard interactions.

Usage totals include real development verification calls. They are not fabricated launch statistics or unique-user counts.

## Re-run

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/api-server run test:protocol
```

For a published release, pass its actual `/mcp` URL to `test:protocol`, then perform the real Claude-account connection check. Do not infer production readiness from a development test or an HTTP 200 alone.
