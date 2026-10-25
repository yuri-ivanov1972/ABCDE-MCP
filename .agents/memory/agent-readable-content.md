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

Use `https://abcde-mcp.replit.app/mcp` as the authoritative connection address in the webpage and its agent-readable documents.

**Why:** The owner explicitly requested this real address, rather than a preview URL or configurable substitute.

**How to apply:** Keep displayed instructions, clipboard output and generated documents aligned. Do not restore an environment override without a new owner request.

The owner selected `https://abcde.lv/lv/mcp` and `https://abcde.lv/en/mcp` for the human pages. The owner controls abcde.lv in a separate Replit project.

**Why:** Language-prefixed paths fit the owner's main website; this does not move the Claude endpoint.

**How to apply:** Treat the human origin and MCP service origin independently. Support here is not proof of routing or publication in the other project. Preserve that site's existing routes and root discovery files.

Do not describe this connector as requiring Claude Pro or Max: the owner states Claude Free supports one MCP connector.

**Why:** The owner corrected the paid-plan-only setup wording.

**How to apply:** Include Free and its one-connector limit when describing plan eligibility. This is an owner-provided product claim, not independently verified vendor policy; recheck current vendor documentation before changing eligibility claims later.
