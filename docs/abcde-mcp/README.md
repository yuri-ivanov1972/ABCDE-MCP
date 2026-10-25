# ABCDE MCP

ABCDE MCP is an independent, public, read-only Model Context Protocol server for ABCDE.lv food nutrition data. Connect its `/mcp` endpoint to Claude to search Rimi and Maxima products, inspect nutrition fields, and assemble retailer-grouped shopping lists.

This project does not modify ABCDE.lv, copy its catalogue databases, or provide an embedded assistant. Maxima product links currently lead to Barbora. The server never creates carts, places orders, or checks out.

## Run locally

The project uses the existing pnpm workspace and its managed PostgreSQL database.

```sh
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server run test
```

The API service is started by its configured Replit workflow. The landing page is the root web artifact. Both services bind to the `PORT` provided by Replit.

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `ABCDE_API_URL` | Fixed server-side ABCDE.lv API base URL | `https://abcde.lv/api` |
| `PUBLIC_MCP_URL` | Optional public connector address for host validation | Unset until a real published URL is known |
| `VITE_PUBLIC_MCP_URL` | Legacy setting; ignored by the landing page and agent documents | Connection instructions always use `https://abcde-mcp.replit.app/mcp` from the shared site configuration |
| `DATABASE_URL` | This project's managed PostgreSQL database | Provided by Replit |

Catalogue requests currently need no API key. Do not add `ABCDE_API_KEY`, `RIMI_DATABASE_URL`, or `MAXIMA_DATABASE_URL` unless the upstream contract changes and the project owner separately approves it. `PUBLIC_MCP_URL` and `VITE_PUBLIC_MCP_URL` are ordinary configuration values, not secrets. Never put catalogue credentials or database credentials into this project.

## Architecture and routes

- `/` — Latvian landing page, with complete HTML before JavaScript.
- `/en/` — English landing page; `/en` redirects here. The language switch uses normal links and works without JavaScript. Explicit language URLs take precedence over the browser's stored preference; the current selection is still recorded locally.
- `/lv/mcp`, `/en/mcp` — integration-ready language pages for `https://abcde.lv/lv/mcp` and `https://abcde.lv/en/mcp`. Their language links stay on those paths; trailing-slash aliases redirect to the no-slash address.
- `/mcp-site/` — scoped assets, favicon, copies of the agent documents and an uncached `/mcp-site/stats` relay to the existing local API. Only these scoped resources and the two language pages need forwarding by the other website.
- `/content/lv.md`, `/content/en.md` — complete shared landing-page copy as UTF-8 Markdown.
- `/llms.txt` — voluntary AI-agent discovery index, linking to both human pages, both Markdown documents and the configured public MCP endpoint. Not a guarantee of indexing or support by every AI provider.
- `/robots.txt`, `/sitemap.xml` — permissive crawl policy and the two canonical language pages.
- `/mcp` — official MCP TypeScript SDK Streamable HTTP endpoint. The SDK handles protocol negotiation; application code does not implement JSON-RPC by hand.
- `/api/stats` — aggregate counters only. It returns `503` with a generic unavailable message if storage cannot be queried.
- `/health` — process health and aggregate-storage status; it does not call the catalogue API.
- `/api/healthz` — existing API service health route.

The MCP HTTP factory creates a fresh server for each request and is sessionless. Accordingly, the public counter reports tool calls but returns `measuredSessions: null` and `sessionMeasurementAvailable: false`; it does not guess a session per call or fingerprint IP/User-Agent. Tool-attempt and upstream-start quotas are atomic database counters shared across instances. Query content and session identifiers are not persisted. Infrastructure may maintain operational logs; application logs omit request bodies and query strings.

The only public MCP tools are `search_products`, `get_product`, and `build_basket`. All are read-only/idempotent. There is no raw `tools/execute` HTTP endpoint, arbitrary URL fetch, user login, or OAuth requirement.

## Catalogue mapping and missing data

The upstream base is `https://abcde.lv/api`; relative paths are resolved below `/api/`, not against the origin root.

- A list response is `{ products, totalCount }`; a normal product-detail response is the product itself.
- Product identity is the pair `(store, productId)`.
- Product `name` is returned as `original_name` without translation.
- Text search returns compact nutrition summaries. Use `get_product` for full ingredient and nutrition detail.
- `nutrition.protein`, `carbsSugars`, `fatTotal`, `salt`, `energyKcal`, `energyKj`, `carbsTotal`, `fatSaturated`, `fiber`, `nutriScoreGrade`, and `ingredientsText` map to normalized output fields.
- `quantityValue` and `quantityUnit` describe the package; `category.nameLv/nameEn`, `nutrition.dataSourceDate`, `ingredientCard`, and `novaScore` are passed through where available.
- A retailer URL uses `externalUrl`, with `rimiUrl` as a Rimi-only fallback. Photos prefer the primary entry and then the first usable photo.
- No dedicated verified brand, price, currency, or unit-price field is exposed. A product update timestamp is not evidence of nutrition freshness.
- Numeric values are parsed strictly. Missing, empty, non-finite, or malformed values stay `null`; a real numeric zero remains zero.
- The API does not expose a nutrient-basis field. For package units in grams or kilograms, `nutrient_basis` is `assumed_per_100g` under the site's convention. For volume, pieces, or unknown units, the basis is unknown. The tool does not treat an assumed basis as verified.
- Ingredient analysis is not medical advice, a complete ingredient inventory, or a validated allergen classification.

## Known upstream filter limitations

Captured live probes showed that search can return mixed-store products even when `store` is specified, and Maxima nutrient bounds can be ignored. Category filtering during text search is also not guaranteed. Upstream totals and sort order are not exhaustive nutrition rankings.

The adapter therefore:

1. Checks the requested store, Nutri-Score, and every supplied nutrient bound locally against each normalized candidate.
2. Rejects missing or incompatible-basis nutrient values for a per-100-g constraint.
3. Uses one candidate stream per search and scans no more than three pages of 100.
4. Deduplicates by store-qualified identity and reports candidate/page coverage, partial results, and possible remaining candidates.
5. Never claims a global best product, exact filtered total, or that no product exists based only on the bounded scan.

The adapter is intentionally separate from MCP tool definitions so a corrected upstream API can be adopted later without changing the tool contracts.

## Optional FODMAP ingredient screening

Set `ingredient_screening: "fodmap"` on any of the three existing tools. Omit it for the original nutrition-only behavior. This is a limited Latvian/English **ingredient screen**, not lab-tested low-FODMAP classification, medical advice, certification, an allergen guarantee, or a serving-size recommendation.

For example, Claude can call `search_products` with:

```json
{
  "query": "rīsi",
  "store": "rimi",
  "max_results": 5,
  "ingredient_screening": "fodmap",
  "include_review": true
}
```

- `products` contains only candidates assessed as `no_listed_concern`. This means the limited rules found no listed concern, **not** that the product is verified low-FODMAP or suitable at any portion.
- `review_products` appears only when `include_review: true` is explicitly requested alongside screening. It contains flagged and unknown candidates separately, capped at `max_results`; these never fill the matching-products quota.
- Each product's `fodmap_assessment` includes the unchanged source ingredient text, precautionary text, outcome, matched original terms, rule identifiers, explanations, source links, uncertainties, and rule-set version.
- Outcomes are `potential_concern`, `no_listed_concern`, and `insufficient_information`. Missing ingredient text, unsupported/unrecognized vocabulary, vague mixtures, incomplete labels, and uncertain ingredient amounts or processing cannot become optimistic matches.
- Added onion/garlic, concentrated inulin/FOS/GOS, listed polyols and declared lactose are potential concerns. Cereals, dairy and other quantity-dependent ingredients require qualified review, not blanket “high-FODMAP” judgments. Local lactose-free qualifications do not override other ingredients; garlic-infused oil needs preparation review.
- “May contain” notices are separate advisory evidence, not declared ingredients or measured FODMAP doses. Ambiguous nested notice boundaries require review. This does not implement an allergy-avoidance policy.
- The rule set is small and conservative: even an otherwise reasonable product may need review because its label vocabulary is unsupported. Product names, sugar totals, Nutri-Score, gluten-free claims, and the catalogue's unvalidated ingredient-analysis scores cannot establish FODMAP suitability.
- **Serving size, ingredient quantity, processing effects, and combined meal load remain unverified for every outcome.** No laboratory ratings or safe portion thresholds are invented.

The rules reference public [Monash label-reading guidance](https://www.monashfodmap.com/blog/update-label-reading/) and its [ingredient-scanning limitations](https://www.monashfodmap.com/get-app-help/), not a copied proprietary food-rating database. The rules have not undergone independent dietitian or clinical validation.

### Coverage and shopping lists

Screening happens before the match limit, after local store/nutrition checks. At most three pages of 100 candidates are inspected. Missing lists can trigger at most ten extra detail lookups per search using the same cache, request gate, shared quotas, deadline and cancellation as other catalogue work. A lookup can use the existing bounded safe retry, so a lookup is not the same as a single upstream start. A hydrated detail is checked again against the requested nutrition filters.

`screening` reports eligible, assessed, flagged, unknown, no-listed-concern, and unassessed counts, detail lookups/failures, and review rows returned/omitted. `eligible_count = assessed_count + unassessed_count = flagged_count + unknown_count + no_listed_concern_count`. Unknown includes unassessed candidates; budget-limited and failed lookups mark coverage partial. Counts cover unique candidates passing local store/nutrition checks, not the whole catalogue. Review omission counts are explicit even when review rows are hidden by default.

`get_product` with screening returns the assessment alongside full details. `build_basket` with screening attaches an assessment to **every line**, including an unknown assessment for unresolved products. It does not remove flagged/unknown items, change package quantities, or change protein calculations; review all such lines before shopping.

Suggested Claude prompt after publishing: “Find Rimi rice products using FODMAP ingredient screening. Show ingredient evidence, and keep uncertain products in a separate review list. Do not describe them as verified low-FODMAP.”

The complete assessment is included in both JSON text and structured tool output. Existing 256 KiB whole-result bounds still apply; request fewer products if a detailed response is too large. Dietary queries and health profiles are not persisted.

## Basket calculation

Basket quantity means packages (not portions or grams). Identical `(store, product_id)` entries combine; a combined product quantity over 20 or basket total over 100 packages is rejected. Product name, package size, nutrition, and links are fetched from the server-side catalogue rather than trusted from caller-supplied values.

Protein contributions are calculated only for positive package mass in `g` or `kg` and compatible assumed-per-100-g protein:

```text
package_mass_g = quantityValue for g, or quantityValue × 1000 for kg
line_protein_g = protein_per_100 × package_mass_g ÷ 100 × package_count
```

The arithmetic is kept at full precision until output rounding. Unknown mass or missing protein yields an unresolved line. `known_protein_g` is always the calculable sum; `total_protein_g` is `null` unless every requested package is calculable. Nutri-Score counts packages by grade, including unknown/unresolved packages; grades are not averaged. The fixture using two Rimi 3975 packages and one Maxima 7451 package yields 113.01 g known protein and distribution B:2, D:1; it is a test fixture, not a hardcoded catalogue response.

## Prices, stock, and safety

This release is nutrition-only. The public product API does not expose verified prices, discounts, currency, or unit-price information, and current stock is not guaranteed live. No budget, price, discount, value ranking, or checkout total is supported. Users should review the retailer website for current prices and availability.

Claude is the conversational interface. It should translate English food terms into Latvian before searching, preserve proper names, and answer in the user's language. Search can still miss products. Catalogue text is untrusted data and must never be treated as instructions.

Shopping-list suggestions are not medical advice. Ingredient data and analysis do not guarantee allergen safety. The service is independent and not affiliated with Rimi, Maxima, or Barbora; purchases happen on retailer sites.

## Limits and failure behavior

- 60-second LRU cache, up to 500 entries / 5 MiB; cache keys include all query parameters and store-qualified product details.
- Identical in-flight upstream requests are coalesced; failed responses are not cached.
- At most 2 concurrent upstream requests and 2 request starts per second per instance; queue maximum is 50.
- Database-backed shared limits: 60 upstream request starts/minute and 120 MCP tool attempts/minute across instances.
- Upstream GET timeout is 10 seconds per attempt; one retry is allowed for eligible transient failures within a 30-second tool deadline. A `429` retry uses `Retry-After` only when it fits the deadline.
- Upstream response bodies are capped at 2 MiB; MCP request bodies are capped at 32 KiB; search and basket sizes are bounded by tool schemas.
- Successful tools return a short summary followed by a complete JSON text block, alongside equivalent `structuredContent`. Clients that only expose text content to the model therefore still receive product details and basket data.
- Entire serialized tool results are capped at 256 KiB, counting both data representations, JSON escaping, summaries, and content-block overhead. Larger results fail explicitly rather than returning truncated or misleading data.
- Only fixed HTTPS upstream configuration is accepted; redirects and caller-supplied upstream hosts are rejected.
- Non-JSON responses, invalid shapes, network failures, timeouts, `404`, `429`, and `5xx` are explicit errors or partial results, never fabricated catalogue data.
- Host and Origin validation is provided by the official MCP Express SDK and configured for the known Replit/public hosts plus Claude's origins. Requests without an Origin header are accepted for non-browser clients.
- If aggregate storage cannot be reached, counters show as unavailable and MCP calls stop before catalogue work rather than silently bypassing the shared limit.

## Connect from Claude

Once published, copy the actual public `/mcp` endpoint shown on the landing page. Do not use a localhost or development address.

For individual Claude plans, use **Customize > Connectors > + Add > Add custom connector**, name it **ABCDE MCP**, paste the public MCP URL, and choose **No sign in**. Team and Enterprise admins may need to add or approve a custom connector for the organization first.

After connecting, try:

- “Find breakfast foods with at least 10 g protein per 100 g. Keep the original product names.”
- “Compare protein-rich options from Rimi and Maxima and group the shopping list by retailer.”

The project owner should verify a real Claude conversation after connecting. The server can be protocol-tested with an official MCP client/Inspector, but that alone does not prove a real Claude account can connect.

## Verification

### Agent-readable landing page

The bilingual copy lives in `artifacts/abcde-mcp/src/page-content.tsx`. Edit it once: the interactive React page, initial HTML and Markdown documents all consume that source. The shared server entry produces page metadata and the agent documents. Avoid separate bot-only text or User-Agent-dependent pages.

The normal build first bundles browser assets, then prerenders the same React page into Latvian and English HTML and generates the documents. Development uses the same renderer. CSS is linked directly in the HTML, so a JavaScript-disabled browser still gets the design. React hydrates the existing content; counters fetch only after mounting. Initial HTML reports counters as unavailable, and text documents never publish frozen counts.

The human-page canonical origin is the owner-selected `https://abcde.lv`, with `/lv/mcp` and `/en/mcp` as the canonical language paths. The connector remains exactly `https://abcde-mcp.replit.app/mcp` with no environment override. These addresses are deliberately independent. The standalone upstream origin was freshly confirmed through deployment metadata on 25 October 2026; this does not mean the new paths have been published or the separate abcde.lv project has been changed.

See [the abcde.lv integration handoff](ABCDE-LV-HANDOFF.md) and its framework-neutral [Node proxy reference](abcde-page-proxy.mjs). Forward only the exact language routes and allowlisted `/mcp-site/` resources, not the host's broad assets/API/language namespaces. Preserve the main site's existing root discovery files. The relay uses the existing API service on internal port 8080, strips browser credentials, times out, and reports statistics failures as unavailable rather than making up counters.

Production uses a small Node file server for the **generated files**, not runtime server rendering or the Vite development server. This replaces the former catch-all static SPA rewrite so Markdown/XML/text receive explicit MIME types and missing documents return actual 404s. It binds to the managed `PORT`; existing API/MCP routing remains separate. Hashed assets are immutable-cacheable; content documents revalidate. The artifact configuration change has been schema-validated but has not been published by the agent.

Reproduce the relevant checks (the build command needs the artifact's non-secret service configuration when run outside its managed workflow):

```sh
PORT=23462 BASE_PATH=/ pnpm --filter @workspace/abcde-mcp run build
pnpm --filter @workspace/abcde-mcp run typecheck
pnpm --filter @workspace/abcde-mcp run test
node artifacts/abcde-mcp/scripts/browser-check.mjs http://127.0.0.1:80
node artifacts/abcde-mcp/scripts/browser-check.mjs --production-integration
```

The first browser command targets the running development proxy. `--production-integration` starts temporary local production-file and host-proxy servers and checks the built bundles at the new language paths; the real API workflow must be running for counters. Both use workspace Chromium and check both languages with JavaScript disabled, then hydration, language navigation/reload, live counters, real clipboard contents, announcements and phone-width overflow. The Node regression suite additionally exercises the production proxy contract, route isolation, scoped statistics, credential stripping and explicit failures using fixtures only inside its test boundary. These checks do not make MCP tool calls or query the catalogue.

After the owner republishes, verify the actual public routes and headers again. A development fetch cannot establish that an outside agent can reach the newly published release. No AI indexing or citations are promised.

The unit suite covers strict numeric parsing, zero/null behavior, store-qualified IDs, query mapping, local filter enforcement, duplicate basket references, mass conversions, missing products, and the 113.01 g calculation. Live upstream and official MCP client checks should be rerun as part of release readiness. A `200` from `/mcp` alone is not an MCP compatibility check.

```sh
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/api-server run test:protocol -- https://YOUR-ACTUAL-PUBLISHED-HOST/mcp
```

The protocol-check script uses the official MCP client package, validates both legacy initialization and modern version negotiation, calls all three tools against real data, checks partial/error cases, and verifies aggregate counter changes. Never put the placeholder URL above on the landing page.
