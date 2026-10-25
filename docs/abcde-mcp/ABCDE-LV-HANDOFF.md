# Add the MCP pages to the abcde.lv project

## Status and boundaries

This is a handoff for the **separate Replit project serving abcde.lv**. Its code
and hosting framework are not in this workspace. Local support and the reference
proxy have been implemented here; the abcde.lv project has not been changed and
the original integration is separate from changes to this workspace. The owner
subsequently confirmed both human pages are live. Preserve them when following
the newer [Claude endpoint migration handoff](CLAUDE-ENDPOINT-HANDOFF.md).

Inspect that project's framework, server entry point, existing routes, language
routing, content security policy and hosting model before editing it. Do not
assume Express, Next.js or a particular deployment type. A static-only host needs
a server-capable forwarding route or an equivalent narrow rewrite facility.
Keep all existing pages and APIs intact.

## Required public addresses

| Purpose | Address |
| --- | --- |
| Latvian human page | `https://abcde.lv/lv/mcp` |
| English human page | `https://abcde.lv/en/mcp` |
| Claude MCP connector — unchanged | `https://abcde-mcp.replit.app/mcp` |

Use a **server-side proxy**, not an iframe or client-side redirect, so visitors
and AI readers receive full HTML at the abcde.lv address before JavaScript.
Do not move the domain or forward `/mcp` on abcde.lv as a side effect.
The separately approved machine-endpoint migration adds exact `/mcp` through its
own streaming proxy; it must not broaden or reuse this human-page proxy.

## Exact routing contract

Upstream origin: **`https://abcde-mcp.replit.app`**, confirmed by fresh Replit
deployment metadata on **25 October 2026** (public, successful Autoscale release).
That confirms the origin, not that this new code has already been published.

Forward these requests to the **same path on that fixed upstream origin**:

- `/lv/mcp` and `/en/mcp`.
- Their trailing-slash and `/index.html` aliases, preserving upstream redirects
  to `/lv/mcp` and `/en/mcp` respectively (no trailing slash).
- `/mcp-site/assets/<filename>`: generated hashed JavaScript, CSS and assets.
- `/mcp-site/favicon.svg`.
- `/mcp-site/content/lv.md` and `/mcp-site/content/en.md`.
- `/mcp-site/llms.txt`, `/mcp-site/sitemap.xml`, `/mcp-site/robots.txt`.
- `/mcp-site/stats`: the landing service reads the existing local API's
  `/api/stats`; this is NOT abcde.lv's own statistics API. Do not cache it.

Only GET and HEAD are supported. Other methods receive 405. Unknown paths in
`/mcp-site/` must receive real 404s, never abcde.lv's successful SPA HTML fallback.
Do not forward broad `/assets/*`, `/api/*`, `/lv/*`, `/en/*`, `/mcp*`, or all requests.
Do not forward browser cookies, authorization, or caller-selected destinations.
Do not add a URL parameter that changes the proxy target.

Use `abcde-page-proxy.mjs` beside this handoff as the framework-neutral Node
reference. It is tested with an actual Node HTTP server and the production-built
landing service. Its `upstreamOrigin` option is for trusted server configuration
and local tests only; production should use its fixed HTTPS default.

For a Node/Express-style server, import `createMcpPageProxy`, create it once, then
await `proxy(req, res)` before authentication middleware, language catch-alls and
the SPA fallback; when it returns true, the response has been handled. When false,
continue normal site routing. In another framework, adapt the request/response
interface and preserve the same allowlist and security properties. The code
accepts Node request/response objects, not Web Request/Response objects.

### Headers and failures

Preserve status codes, UTF-8 Content-Type and cache behavior. Return 502 on proxy
failure and preserve the upstream statistics 503 rather than inventing counts.
Allow only same-upstream page redirects, rewriting Location to a local path.
Do not copy upstream Set-Cookie, hop-by-hop headers or mismatched compressed
Content-Length. The reference buffers a bounded 4 MiB response and times out
after 10 seconds. Static assets are immutable; HTML/text documents revalidate.

Check the main site's CSP: these pages use same-origin JavaScript/CSS, images
and `/mcp-site/stats` fetches. They use system fonts, with no Google Fonts
requests. The real abcde.lv logo is bundled under `/mcp-site/assets/` and its
self-contained favicon is served at `/mcp-site/favicon.svg`; no extra proxy
routes or main-site root asset overrides are needed. Add only necessary allowances,
without weakening policies for the rest of the site. Check any service worker
does not intercept the MCP pages or scoped resources with unrelated cached HTML.
If any existing route already occupies `/mcp-site/`, stop and reconcile it rather
than overwrite it.

## Site-wide discovery: additive changes only

- Add both human page URLs to abcde.lv's existing sitemap, or reference
  `https://abcde.lv/mcp-site/sitemap.xml` from its sitemap index.
- Add `Sitemap: https://abcde.lv/mcp-site/sitemap.xml` to the existing root
  robots.txt if appropriate; retain all its current crawl rules.
- If the main site has a root llms.txt, add links to the two pages and
  `https://abcde.lv/mcp-site/llms.txt` without replacing its other content.
- Do NOT replace abcde.lv's root robots.txt, sitemap.xml or llms.txt with the
  standalone service's copies. A robots.txt under `/mcp-site/` is a content file,
  not a substitute for the host's root robots policy.

The pages declare the chosen abcde.lv canonical/hreflang URLs even on the
standalone service. This is an intended migration target, not evidence of
indexing, crawl access or an already-completed public migration.

## Staged release

1. Finish local verification in this MCP project. Ask the owner to publish it.
   Do not publish automatically.
2. After publishing, unauthenticated fetches of the upstream `/lv/mcp`,
   `/en/mcp`, scoped assets/docs and `/mcp-site/stats` must succeed. Inspect
   initial HTML, not only the HTTP status. Confirm `/mcp` remains the MCP service.
3. Implement and locally verify the narrow proxy in the abcde.lv project.
   Confirm its existing pages, APIs and discovery files are unchanged.
4. Ask the owner to publish abcde.lv. Verify the actual public URLs below.
5. If integration fails, remove only the new forwarding routes in abcde.lv;
   the standalone `/` and `/en/` pages and Claude connector remain available.

## Verification commands and browser checks

Run against upstream after step 1 and against abcde.lv after step 4:

```sh
BASE=https://abcde.lv
curl -fsS "$BASE/lv/mcp" | grep 'lang="lv"'
curl -fsS "$BASE/en/mcp" | grep 'lang="en"'
curl -fsS "$BASE/lv/mcp" | grep 'https://abcde.lv/lv/mcp'
curl -fsS "$BASE/en/mcp" | grep 'https://abcde.lv/en/mcp'
curl -sSI "$BASE/lv/mcp/"
curl -sSI "$BASE/en/mcp/"
curl -sSI "$BASE/mcp-site/content/lv.md"
curl -sSI "$BASE/mcp-site/content/en.md"
curl -fsS "$BASE/mcp-site/llms.txt"
curl -fsS "$BASE/mcp-site/sitemap.xml"
curl -sS -D - "$BASE/mcp-site/stats"
curl -sS -D - "$BASE/mcp-site/content/missing.md"
```

Expect full human HTML, canonical/alternate URLs at abcde.lv, 308 slash
normalization, text/markdown UTF-8, a real missing-document 404 and JSON statistics
(or explicit 503 on API/storage failure). Follow the actual asset URLs found in
the built HTML and check JavaScript/CSS MIME types rather than guessing hashes.

In a browser verify both routes with and without JavaScript, language switching,
reload, mobile layout, live counters, no hydration/CSP errors and clipboard
content **exactly** `https://abcde-mcp.replit.app/mcp`. Check unrelated abcde.lv
pages and API calls still work. Public checks are still required even after
local integration tests pass; do not claim AI-provider indexing.

## Pasteable instruction for the abcde.lv agent

> Integrate the ABCDE MCP landing pages at /lv/mcp and /en/mcp using the attached
> handoff and, if supplied, abcde-page-proxy.mjs as a reference. If the reference
> file is unavailable, implement the exact allowlist and forwarding contract
> described above using this project's framework. First inspect the framework,
> existing routes, CSP and hosting model. Add only the allowlisted server-side
> forwarding routes to https://abcde-mcp.replit.app, preserving HTML, documents,
> assets, redirects, status codes and scoped statistics. Keep the Claude endpoint
> https://abcde-mcp.replit.app/mcp unchanged. Do not replace root discovery files,
> broad-proxy the website or forward browser credentials. Verify locally and
> ask before publishing. Report public readiness separately from local success.
