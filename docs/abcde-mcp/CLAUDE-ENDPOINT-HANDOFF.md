# Connect Claude at https://abcde.lv/mcp

## Scope and current status

**Update — 25 October 2026:** The owner reports both projects published. Direct
official-client checks passed on both public MCP addresses, including both
negotiation modes and live calls to all three tools with complete product data.
The owner also confirmed that Claude returned actual product details using
https://abcde.lv/mcp. This workspace now selects that address for its landing
page and AI documents; publishing that final instructions change remains a
separate owner action. The staged instructions below also serve as the rollout
and recovery reference, not a claim that earlier pending steps remain undone.

This handoff is for the **separate abcde.lv Replit project**. Its source is not
present in the MCP workspace, and it has not been edited or published by this work.
The owner confirms the human pages are already live:

- Latvian: https://abcde.lv/lv/mcp
- English: https://abcde.lv/en/mcp

The new machine endpoint must be **https://abcde.lv/mcp**. Keep the existing
**https://abcde-mcp.replit.app/mcp** working, with no redirect away from either URL.
The server and database stay in the MCP project.

Before this implementation, an unauthenticated GET to abcde.lv/mcp returned
200 text/html. A successful HTML page is NOT evidence of an MCP connection.
This workspace now provides dual-host backend support, a dedicated streaming
proxy reference and release-gated advertised-address support. Publish and verify
each stage below; local tests do not establish public or real-Claude readiness.

The fixed upstream origin was freshly confirmed by this project's deployment
metadata on 25 October 2026: https://abcde-mcp.replit.app. That metadata does not
confirm that these new changes have been published.

## Files to give the other project's agent

1. This document: `CLAUDE-ENDPOINT-HANDOFF.md`.
2. The adjacent `abcde-mcp-proxy.mjs` (Node built-ins only).
3. Optional: `abcde-mcp-proxy.test.mjs`, runnable with
   `node --test abcde-mcp-proxy.test.mjs` if kept beside the reference module.

Do not transfer secrets, database credentials or the catalogue backend. Do not
reuse `abcde-page-proxy.mjs` for the machine endpoint: that proxy is GET/HEAD-only,
buffers responses and has a 10-second timeout. Leave it unchanged for human pages.

## Routing and transport contract

First inspect the website's framework, server entry point, middleware order,
deployment routing, request logging, compression, CSP and service worker.
The reference accepts Node IncomingMessage/ServerResponse, not Web Request/Response.
Adapt it to the actual framework; do not assume Express or static rewrite support.
A static-only route cannot execute this module without server-capable routing.

- Handle **exactly `/mcp`**, before JSON/body parsers, authentication middleware,
  language redirects, HTML/SPA fallback and response compression/buffering.
- Send requests only to the fixed **https://abcde-mcp.replit.app/mcp**.
  Never derive the destination from headers, query parameters, request bodies or
  forwarded host. The reference deliberately ignores all query parameters.
- POST carries raw JSON bytes. GET, DELETE and HEAD preserve upstream SDK behavior;
  the current stateless SDK returns 405 for GET/DELETE. Handle valid OPTIONS
  preflight locally. Do not require sessions or invent session IDs.
- Preserve Accept, Content-Type, Origin, MCP-Protocol-Version, Mcp-Session-Id,
  MCP-Method, MCP-Name and Last-Event-ID when present. Modern MCP header/body
  cross-checks depend on MCP-Method and MCP-Name.
- Preserve upstream status codes, JSON and SSE Content-Type, supported MCP
  response headers, Allow and Retry-After. Initialized notifications may return
  **202 with no body**; this is success, not an error.
- Forward SSE/JSON responses progressively, respecting backpressure. Do not call
  response.text()/json(), buffer the whole response, wrap results in HTML or
  redirect Claude to the upstream URL. Disable gateway/CDN/compression buffering
  specifically for this route and use no-store caching.
- The reference buffers only the raw request (max **32 KiB**), not the response;
  it caps streamed response bytes at **4 MiB**. It makes no automatic POST retries.
- Allow **45 seconds total** at the proxy so the upstream's 30-second tool
  deadline has time to return. Ensure the hosting layer does not cut off earlier.
  A stalled upstream before headers returns 504. Network/invalid upstream
  responses return 502. Failures after streaming begins close the stream rather
  than appending invented protocol output.
- Client disconnect must cancel the upstream request, including an active stream.
- Do not forward cookies, Authorization, X-Forwarded-* or unrelated site headers.
  This is a public read-only connector with no login/OAuth requirement.
- Validate actual Host and Origin. Production defaults allow Host `abcde.lv`
  and exact HTTPS origins for abcde.lv, the existing upstream and Claude
  (`claude.ai`, `claude.com`, `www.claude.com`). Missing Origin is valid for
  server-to-server clients; unknown/present malformed origins are rejected.
  Never trust arbitrary forwarded headers or wildcard origins.
- If a known deployment layer rewrites Host, inspect its trusted routing contract
  and add only required server-configured hosts; do not remove validation.
- Never log request bodies, query content, session headers or credentials.

The reference rejects upstream redirects and HTML fallback. Its option arguments
are for trusted server configuration and local fixtures only. Production should
use the default fixed HTTPS upstream and normal limits.

### Express-style mounting example

After copying the module into this project and adjusting its import path:

```js
import { createMcpProxy } from './abcde-mcp-proxy.mjs';
const proxyMcp = createMcpProxy();

// BEFORE express.json(), auth, compression and catch-all routing:
app.use(async (req, res, next) => {
  try {
    if (await proxyMcp(req, res)) return;
    next();
  } catch (error) {
    next(error);
  }
});
```

In other frameworks preserve the same security, bounds and streaming behavior.
An already-consumed JSON body is not equivalent to forwarding the original bytes;
the reference fails explicitly if mounted after a parser.

Do not change `/lv/mcp`, `/en/mcp`, `/mcp-site/`, `/api/`, catalogue routes or root
discovery files as a side effect. Do not broad-proxy `/mcp*` or the entire website.
The human-page proxy and machine-endpoint proxy must coexist.

## Staged release and advertised URL

1. **Owner publishes the MCP project first.** It now explicitly trusts both
   public hostnames independently of `PUBLIC_MCP_URL`, while retaining SDK
   Host/Origin protections. Existing direct connections remain supported.
2. In abcde.lv implement and locally verify the dedicated machine proxy.
   Verify unrelated pages/APIs and existing landing-page resources still work.
   Ask the owner before publishing abcde.lv.
3. After publication run actual MCP negotiation, tool listing and bounded
   product calls on **both addresses**, including a client using
   `Origin: https://abcde.lv`. Check text results contain names, IDs and nutrition,
   not just summary lines. Check errors/notifications and streaming where used.
4. Connect a real Claude account to **https://abcde.lv/mcp** with no authentication.
   Ask for a specific Rimi product and confirm original names, IDs, nutrition and
   retailer links are visible. SDK checks alone do not prove Claude usability.
   Do not remove the old connector until the new one is confirmed in Claude.
5. **Only after public verification**, promote the advertised address in the MCP
   project by changing `artifacts/abcde-mcp/src/connection.json` to:

   ```json
   { "primaryEndpoint": "https://abcde.lv/mcp" }
   ```

   This one allowlisted build-time setting feeds human HTML, browser clipboard
    output, both Markdown documents and llms.txt. It now selects the main-domain
    address after public checks and owner Claude confirmation. It is not an environment variable, secret, Host allowlist or proxy
   destination. Do not set obsolete `VITE_PUBLIC_MCP_URL` or perform string
   replacement on proxied HTML.
6. Rebuild and verify both languages, hydration and exact clipboard output, then
   ask the owner to republish the MCP project. The existing human-page proxy
   serves the updated instructions; verify cache freshness on abcde.lv.

The other project cannot promote the shared page setting unless it has access to
the MCP source. Report completion of its route back to the MCP project's agent.

## Public verification examples

Run against each URL, not only the development preview:

```sh
URL=https://abcde.lv/mcp
# Repeat with URL=https://abcde-mcp.replit.app/mcp

curl --max-time 40 -i -N "$URL" \
  -H 'Origin: https://abcde.lv' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"abcde-release-check","version":"1.0"}}}'

curl --max-time 40 -i -N "$URL" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Protocol-Version: 2025-03-26' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

curl --max-time 40 -i -N "$URL" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Protocol-Version: 2025-03-26' \
  --data '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_product","arguments":{"store":"rimi","product_id":3975}}}'
```

Expect protocol JSON/SSE, not successful HTML. Tools must include exactly
search_products, get_product and build_basket. Successful product output has
both structuredContent and a complete parseable JSON text block with matching
data. Catalogue values may change; no pinned nutrition totals are required.

Check rejected Origin (403), unsupported stateless GET/DELETE (405), initialized
notification (202), payload limit (413), no-store, no redirect, valid MIME and
unaffected human-page routes. Test modern negotiation with the official client
as well as the legacy handshake shown above.

In this MCP workspace, after its workflows are running:

```sh
pnpm --filter @workspace/api-server run test:proxy
pnpm --filter @workspace/api-server run test:proxy-protocol
```

The latter explicitly makes a small number of live catalogue/tool calls and
compares direct/proxied SDK negotiation when run without arguments. It defaults
to the development shared gateway, not the public site. Public targets are
checked directly, without adding a second local proxy. To check a public target:

```sh
cd artifacts/api-server
node proxy-protocol-check.mjs https://abcde.lv/mcp
# Repeat with the original direct URL.
```

Do not claim these commands were run publicly unless they actually were.

## Recovery

Keep the direct upstream available throughout. If the new main-site proxy fails,
remove only its exact `/mcp` handler, not the human-page integration. Existing
Claude connections using the old URL continue working.

If the advertised URL has already been promoted, set connection.json back to
https://abcde-mcp.replit.app/mcp, rebuild and republish with owner approval.
Do not remove either trusted public host or redirect the old connector.
Clients configured with the failed new URL must be changed back explicitly.

## Paste this instruction into the abcde.lv project

> Add the exact /mcp machine endpoint according to CLAUDE-ENDPOINT-HANDOFF.md,
> using abcde-mcp-proxy.mjs as a Node reference if compatible with this framework.
> The upstream is fixed at https://abcde-mcp.replit.app/mcp. Keep both public
> connector addresses working and preserve the live /lv/mcp and /en/mcp pages.
> Inspect framework and middleware order first. Mount before body parsers,
> auth, compression and HTML fallback. Preserve raw protocol bodies/headers,
> progressive JSON/SSE responses, statuses, cancellation and no-store. Keep
> Host/Origin checks, bounded input and timeouts; never forward site credentials
> or accept caller-selected destinations. Do not reuse the buffered page proxy.
> Verify locally and ask before publishing. After publication report actual MCP
> checks separately from HTML/page checks, so the MCP project can safely promote
> its advertised address. Do not claim real-Claude success without testing Claude.
