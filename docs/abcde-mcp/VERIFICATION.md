# Verification record

## Main-domain address promoted — 25 October 2026

**Implemented and verified locally; the final instructions update awaits owner publication.**

- The owner explicitly confirmed that Claude returned actual product details
  using https://abcde.lv/mcp and approved proceeding. This is owner-observed
  acceptance; the agent did not access the owner's Claude account.
- The shared landing-page setting now selects https://abcde.lv/mcp. Both
  language pages, initial HTML, browser clipboard and generated Markdown/llms.txt
  consume that setting. The original direct endpoint remains supported with no
  backend host-policy, route, tool, database or authentication changes.
- Landing TypeScript checking and production build passed. The existing nonfatal
  tooltip sourcemap warning remains.
- All 22 landing-page/document regression tests passed, including isolated
  renders using each approved endpoint, rejection of invalid selections and
  obsolete environment overrides, and the built human-page proxy contract.
- Chromium checked the built production bundle through the human-page proxy:
  no-JavaScript content in both languages, hydration/navigation/reload, actual
  aggregate counters, actual clipboard contents, copy announcements and mobile
  overflow. The endpoint copied exactly https://abcde.lv/mcp; no fresh
  JavaScript/hydration errors were observed.
- The public-check helper now connects directly to public targets instead of
  inserting another local proxy. With no arguments it retains the development
  direct-versus-reference-proxy comparison; --direct-only also works for local
  targets.
- The updated helper passed against both https://abcde.lv/mcp and
  https://abcde-mcp.replit.app/mcp: legacy and automatic modern negotiation,
  exactly three read-only tools, successful live calls to all three, complete
  JSON-text/structured parity, unknown-Origin rejection, notifications 202 and
  stateless GET/DELETE 405 without HTML fallback.
- The unchanged local proxy comparison also passed using the updated helper.
  These explicit live checks incremented real aggregate counters; none were reset.
- The managed landing workflow was restarted after the changes.

No publication or separate-project edits were performed by the agent. After the
owner republishes this project, verify fresh instructions on both abcde.lv
language pages, the copied endpoint and scoped text documents. Public machine
endpoint success does not establish that the newly built human instructions
are already live. The earlier sections below describe historical stages.

## Main-domain Claude endpoint preparation — 25 October 2026

**Local readiness verified; no public cutover or publication performed.**

- API and landing-page TypeScript checks passed.
- API build/start passed through its managed workflow; landing-page production
  build passed. Both managed workflows restarted and are serving requests.
- 55 backend unit tests passed, including explicit dual-public-host and
  untrusted Host/Origin rejection checks.
- 9 dedicated machine-proxy tests passed: exact route isolation, raw bytes and
  MCP headers, stripped credentials, Host/Origin checks, preflight, input limits,
  progressive SSE before upstream completion, disconnect cancellation, method
  and error statuses, no-store, rejected redirects/HTML, response size and
  stalled-request limits, and explicit rejection of post-parser mounting.
- 20 human-page/agent-document tests passed. A separately configured renderer
  verified promotion to the main-domain address in both HTML languages and all
  relevant text documents; invalid advertised addresses fail explicitly.
- The official MCP client checked the real running development backend directly
  and through the new proxy reference, using both legacy and automatic modern
  negotiation. Exactly three read-only tools were listed. All three tools were
  called through the proxy in both modes; complete JSON text matched
  structuredContent, including names and store-qualified product IDs.
- Actual direct/proxy calls with the main-site Origin passed; unknown origins
  were rejected. Notifications returned 202 and stateless GET/DELETE returned
  SDK 405, without successful HTML fallback.
- The built landing pages passed the existing direct Chromium check through the
  human-page proxy contract: JavaScript-disabled HTML, hydration/navigation,
  statistics, actual clipboard text, scoped assets and 390 px overflow.
- A fresh development preview screenshot showed the branded Latvian page with
  no fresh application errors.

The advertised setting intentionally remains
https://abcde-mcp.replit.app/mcp. No code or routing was changed in the separate
abcde.lv project. Deployment metadata confirms the existing upstream URL, not
publication of this implementation.

Follow `CLAUDE-ENDPOINT-HANDOFF.md`: publish upstream support, implement/publish
the main-site exact machine route with owner approval, verify actual public MCP
on both addresses and a real Claude connection, then promote the shared
advertised address and republish. Public gateway behavior, sustained concurrent
slow-reader load and main-domain real-Claude acceptance remain unverified here.

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

## FODMAP ingredient screening — 2026-10-24

### Data and scope

- A bounded public catalogue sample checked list and detail ingredient text for two Rimi products (3975, 6504) and two Maxima products (7451, 5777). All four included ingredient text in both responses. This small sample does not establish catalogue-wide ingredient availability.
- Each sampled product also had an ingredient-analysis object with general ingredient/count fields. Those are not validated FODMAP measurements and are not used as a suitability verdict.
- The optional screen uses a small deterministic Latvian/English rule set referencing Monash's public label-reading guidance and ingredient-scanning limitations. It has not undergone independent dietitian or clinical validation. Unsupported words, uncertain amounts or processing, missing lists and ambiguous labels remain unknown; even `no_listed_concern` is not verified low-FODMAP suitability.

### Passed in development

- All **53 automated tests** passed: the earlier 27 plus 26 FODMAP and screening-search regressions.
- Coverage includes bilingual/accented aliases, unchanged ingredient evidence, word boundaries, compound ingredients, unsupported language, unknown vocabulary, order/amount uncertainty, locally scoped lactose-free qualifications, garlic-infused oil, separate precautionary notices, ambiguous notice boundaries and oversized screening text.
- Search tests cover default exclusion, explicit bounded review rows, continuing after rejected candidates, detail hydration, the ten-lookup ceiling, failed/mismatched details, local store/nutrition checks before and after hydration, deduplication, three-page/300-candidate bounds, later-page partial failure, and cancellation before/during requests.
- Basket tests verify retained lines/quantities, unknown missing-product assessments, unchanged protein contributions, and no screening fields for ordinary requests. Formatter tests preserve the complete assessment in compact search results and equivalent text/structured output.
- API TypeScript checking passed. The production API bundle built successfully during the single managed API workflow restart; the service came up on its configured port.
- Official-client checks against the development `/mcp` endpoint passed for legacy initialization and modern automatic negotiation. Each mode checked screened product details for both retailers, default search exclusion, separate review results, screening-count consistency, and complete/partial baskets with unchanged nutrition totals and lines.
- All three tools' full screening evidence survived output-schema validation and matched the JSON text representation. **34 actual tool attempts** were reflected in aggregate counters, including the original nutrition-only checks; counters were not reset.
- No landing-page, slide-deck, authentication, database-schema or publication settings were changed. Whole-workspace TypeScript checking was not repeated: the previously recorded unrelated slide chart errors remain outside this task; the relevant API check passed.

### Not yet verified

- This feature has not been published by the agent. Development success does not establish that the currently published connector has the new schema or behavior.
- After the owner republishes, obtain the actual endpoint using deployment metadata, rerun `test:protocol` against it, then verify a real Claude conversation requesting FODMAP-screened products and ingredient evidence. If the connector retains an older tool definition, refresh its tool definitions before retrying.
- The conservative rule set has not been evaluated against a representative, independently reviewed Latvian/English label corpus. Language/ingredient vocabulary expansion needs sourced rules and regression fixtures, not optimistic guessing.
- No laboratory FODMAP ratings, safe serving amounts, personalized tolerances or combined-meal FODMAP totals were verified or invented.

## Agent-readable webpage — 2026-10-24

### Passed in development and local production-file checks

- Deployment metadata confirmed the public successful release at `https://abcde-mcp.replit.app`. A read-only GET confirmed the existing `/mcp` route returns its expected method-not-allowed response, not landing-page HTML. No new MCP tool calls were made for this work.
- Extracted the existing bilingual copy into one source consumed by the interactive page, prerendered HTML and Markdown. Root remains Latvian; English is at `/en/`, and language navigation works with plain links. URL language overrides any stored preference.
- Landing-page TypeScript checking passed. The production build generated both full HTML pages, bundled assets, both Markdown documents, `llms.txt`, `robots.txt` and `sitemap.xml`.
- All **10 landing-page regression tests passed**: substantive initial HTML and shared-copy parity for both languages; canonical/language/discovery metadata; language precedence; document content and limits; endpoint validation; generated-file content types/UTF-8/HEAD behavior; real 404s and malformed/method rejection; redirects and resolving hashed asset URLs.
- HTTP checks through the development proxy returned 200 and the expected content types for `/`, `/en/`, `/content/lv.md`, `/content/en.md`, `/llms.txt`, `/robots.txt` and `/sitemap.xml`. The initial HTML root was populated. `/content/missing.md` returned a plain-text 404 rather than SPA HTML.
- Headless Chromium checks with JavaScript disabled verified both complete language pages, all four setup steps, all six limitations, linked Markdown and applied CSS.
- With JavaScript enabled, Chromium verified hydration, language switching and reload, stored selection, real aggregate-counter loading, endpoint and prompt copying into the actual clipboard, accessible success announcements and phone-width navigation without horizontal overflow. The completed pass reported no fresh JavaScript or hydration errors.
- Desktop Latvian and 390 px English screenshots confirmed the existing cream/green design remains intact.
- The managed web workflow was restarted after the coherent code/configuration changes and came up cleanly. The API, catalogue, dietary rules, schema and slides were not changed; their suites were not needlessly repeated.
- Production serving configuration was schema-validated. Generated files use a small Node server with explicit text/Markdown/XML MIME types, correct HEAD responses and no catch-all HTML fallback. The production-server behavior was checked locally by the regression suite.

### Publication remains separate

- No publication was performed. The current public release is not claimed to contain these changes.
- After owner publication, obtain fresh deployment metadata and check public routing, actual headers, canonical/language links, no-JavaScript page bodies, Markdown/index content, and missing-document 404s. This is particularly important because the web artifact now serves generated files through its own production process rather than the former static SPA catch-all.
- AI providers may choose not to crawl or index these pages. `llms.txt` is a discovery aid, not a universally supported protocol or a promise of citations.

## Main-website language routes — 2026-10-25

### Passed locally

- Fresh deployment metadata confirmed `https://abcde-mcp.replit.app` as this project's public successful upstream release. The human-page targets are owner-selected `https://abcde.lv/lv/mcp` and `https://abcde.lv/en/mcp`; the Claude connector address remains exactly `https://abcde-mcp.replit.app/mcp`.
- Landing typecheck and production build passed. All **18 regression tests passed**, covering the four human routes, shared initial HTML/Markdown, public metadata, scoped generated assets/documents, real 404s, HEAD/MIME behavior and slash normalization.
- Actual Node HTTP integration tests forwarded built pages through the framework-neutral proxy reference. Unrelated host routes remained untouched; test-only statistics fixtures verified credential stripping, correct counters, no caching and explicit 503 behavior. An unavailable upstream returned a bounded 502.
- Chromium ran against the **built production bundle through the local host proxy**, not just Vite: both new language paths worked with JavaScript disabled; hydration, language switching/reload, actual local API counters, endpoint/prompt clipboard actions, announcements and phone-width overflow checks passed without fresh JavaScript/hydration errors.
- Development HTTP returned 200 for both new routes and scoped statistics. Desktop Latvian and 390 px English screenshots showed the existing design intact. The managed web workflow restarted cleanly.
- No MCP/backend/API/schema/dietary-rule changes were made. Statistics forwarding is a landing-server route to the existing local API, not a new data source. No tool calls or catalogue lookups were made for this work.

### Remaining launch steps

- No publishing occurred. This workspace does not contain the separate abcde.lv website and has not changed its routing, CSP, discovery files or deployment.
- `ABCDE-LV-HANDOFF.md` specifies narrow forwarding, staged publication, framework inspection and public checks. Its adjacent `abcde-page-proxy.mjs` is a tested Node reference, not a claim that abcde.lv uses Node request/response middleware.
- Publish this MCP project first, check the upstream paths, then apply and verify the handoff in the main website project before publishing that project. Public URLs and main-site CSP/service-worker compatibility remain unverified until those steps are performed.

## Main-site branding alignment — 2026-10-25

- Reused the actual logo and self-contained SVG favicon from abcde.lv. The local
  production/proxy regression verifies their byte hashes and MIME/HEAD responses.
- Verified the main site's primary color (`hsl(147 62% 30%)`) and system sans
  typography from live HTML/CSS. Applied its white/light-gray surfaces, dark text,
  green controls, restrained borders and rounded cards to both language pages.
- Removed Google Fonts dependencies from HTML and CSS. Brand files stay within
  existing `/mcp-site/` forwarding paths; no proxy allowlist expansion is needed.
- Landing typecheck, production build and all **19 regression tests passed**.
  The existing nonfatal tooltip sourcemap warning remains.
- Chromium against built production files through the local host proxy passed:
  both no-JavaScript language pages and real logo loading, system typography,
  hydration, navigation/reload, real local API counters, endpoint and prompt
  clipboard contents, announcements, and mobile overflow checks.
- Inspected desktop Latvian (1280 px) and mobile English (390 px) screenshots;
  branding and layouts rendered correctly with no fresh browser errors. The
  managed web workflow restarted cleanly.
- Existing content, metadata, AI documents, connector endpoint and MCP/backend
  behavior remain unchanged. This update has not been published; no changes
  were made to the separate abcde.lv project.
