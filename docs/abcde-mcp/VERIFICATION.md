# Verification record

Initial development baseline checked on 2026-10-24. The owner subsequently published the project. The later production diagnosis and development-only compatibility fix are recorded below; this record does not claim the fix has been published.

## Initial development baseline — passed

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

## Initial development baseline — not yet verified

- The eventual published URL and production routing/migrations.
- A real Claude account adding and using the connector.
- Multi-instance stress/load behavior, cache-eviction pressure, and quota-boundary contention under production traffic. The application uses atomic PostgreSQL shared buckets, but the development checks are not a multi-instance load test.
- Manual screen-reader/keyboard and real-browser clipboard testing. Copy controls and live status announcements are implemented; screenshots do not verify clipboard interactions.

Usage totals include real development verification calls. They are not fabricated launch statistics or unique-user counts.

## Claude text-result compatibility — 2026-10-24

### Observed on the published release before the fix

- Deployment metadata confirmed a public, successful autoscale release at `https://abcde-mcp.replit.app`.
- The owner reported adding `https://abcde-mcp.replit.app/mcp` to Claude, but Claude could see only search-summary sentences, not specific products.
- A read-only official-client check using legacy negotiation confirmed all three tools were available. A Rimi search for `auzu` returned two real products with IDs, original names, nutrition, and retailer links in `structuredContent`, but text `content` contained only a summary.
- This establishes a server response compatibility gap consistent with the owner's Claude report, not a failure to connect. It does not independently prove how Claude internally processes structured results.

### Fixed and verified in development

- All successful tools now return a summary plus a separate complete JSON text block, in addition to their unchanged structured data. Names, identifiers, links, numeric zero, unknown/null values, warnings, and partial totals are preserved.
- The 256 KiB bound now measures the entire serialized result object, including both representations, JSON escaping, the summary, and content-block overhead. Oversized responses produce an explicit error, not truncated product data.
- All 27 automated tests passed, including seven new serializer regression tests: search, empty search, detail with missing nutrition, partial basket, explicit error, exact byte boundary, and duplicate/escaped/UTF-8 payload limits.
- The API service TypeScript check passed. Its production bundle built successfully as part of the managed development workflow restart, and the service started cleanly.
- Official-client checks against the development `/mcp` endpoint passed for both legacy initialization and modern automatic negotiation. Each mode exercised all three tools and compared the complete JSON text block with structured data.
- The development checks included the 113.01 g complete basket, empty filtered search, partial basket, missing products, all-failed basket, and duplicate quantity errors. All 22 actual tool attempts were reflected in aggregate counters; counters were not reset.
- Whole-workspace TypeScript checking was attempted but is blocked by existing nullable-reduction errors in the slides artifact's `src/widgets/ImportedChart.tsx` (line 78). The API, landing page, mockup sandbox, and scripts checks passed. No slide files were changed for this fix.

### Publication and real Claude confirmation still pending

1. The owner must republish the updated code. Restarting a development workflow does not update the published endpoint.
2. After publication, obtain the actual published URL from deployment metadata and run the updated protocol checks against its `/mcp` endpoint.
3. Start a new Claude conversation with the connected ABCDE MCP tool enabled and repeat “I want you to suggest me healthy products from Rimi”. Confirm that Claude uses actual product names and nutrition data rather than category-only guesses. Record the owner's observed result; do not claim access to their account.

No production deployment or real Claude conversation was performed as part of this fix.

## Re-run

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/api-server run test:protocol
```

For a published release, pass its actual `/mcp` URL to `test:protocol`, then perform the real Claude-account connection check. Do not infer production readiness from a development test or an HTTP 200 alone.
