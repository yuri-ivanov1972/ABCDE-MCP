---
name: Agent-readable content
description: Why public content must remain readable without JavaScript and avoid an HTML document fallback
---

Keep the human landing page itself readable in initial HTML, not merely a separate agent-only summary or an llms.txt file.

**Why:** The owner requested webpage content be available to AI agents. The previous permissive robots policy was insufficient because plain fetches got an empty JavaScript app shell. Agent access does not imply JavaScript execution or universal llms.txt support.

**How to apply:** Preserve shared bilingual content across human HTML and text representations. Keep language links usable without JavaScript and never claim guaranteed AI indexing or citations.

Avoid restoring a catch-all HTML success response for missing content documents.

**Why:** Agent clients need predictable text/Markdown/XML MIME types and genuine missing-file status codes; a successful HTML SPA fallback is misleading. The lightweight production file server was chosen for those guarantees, not because runtime SSR is required.

**How to apply:** Any hosting or routing change must preserve those response contracts and be checked on the published release separately from development.

The owner wants `https://abcde.lv/mcp` as the primary Claude connection address, while keeping `https://abcde-mcp.replit.app/mcp` working.

**Why:** The owner explicitly requested the main-domain connector address and confirmed that both addresses should keep working. This supersedes the earlier requirement to fix the advertised address to the standalone service.

**How to apply:** Keep displayed instructions, clipboard output and generated documents aligned. Verify a real MCP route on the main domain before promoting it in public instructions; ordinary successful HTML is not proof of MCP support. Retain backward compatibility for existing Claude connections.

The owner confirmed on 25 October 2026 that Claude returned actual product
details through `https://abcde.lv/mcp` and approved making it the advertised address.

**Why:** This is owner-observed Claude acceptance, not an inference from SDK
tests. It satisfies the agreed manual acceptance gate for this migration.

**How to apply:** Keep the main-domain address primary and the direct address
working. Do not repeatedly ask for the same migration confirmation; require
fresh acceptance only for a material future compatibility change.

Keep the machine-endpoint proxy separate from the human-page proxy, and keep
dual-host server trust independent of which address is advertised.

**Why:** The existing human proxy buffers GET/HEAD content with a short timeout;
MCP needs raw POST protocol bytes, progressive JSON/SSE, longer tool deadlines
and disconnect cancellation. Promoting instructions must not retire old clients.

**How to apply:** Mount exact machine routing before body parsers and website
fallback. Do not broaden the human proxy, trust arbitrary forwarded hosts,
rewrite proxied HTML strings or use an MCP redirect as the migration mechanism.

The owner selected `https://abcde.lv/lv/mcp` and `https://abcde.lv/en/mcp` for the human pages. The owner controls abcde.lv in a separate Replit project.

**Why:** Language-prefixed paths fit the owner's main website; this does not move the Claude endpoint.

**How to apply:** Treat the human origin and MCP service origin independently. Support here is not proof of routing or publication in the other project. Preserve that site's existing routes and root discovery files.

The owner confirmed both main-site language pages are live on 25 October 2026.

**Why:** The owner supplied the integration status when discussing the main-domain Claude endpoint.

**How to apply:** Preserve the established human routes while integrating the separate machine endpoint. Do not treat the human-page proxy as an MCP transport proxy.

Do not describe this connector as requiring Claude Pro or Max: the owner states Claude Free supports one MCP connector.

**Why:** The owner corrected the paid-plan-only setup wording.

**How to apply:** Include Free and its one-connector limit when describing plan eligibility. This is an owner-provided product claim, not independently verified vendor policy; recheck current vendor documentation before changing eligibility claims later.
