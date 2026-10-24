---
name: MCP schema compatibility
description: Why the MCP server uses a newer direct Zod dependency than the workspace catalog
---

Use a direct modern Zod dependency for official MCP SDK v2 tool schemas rather than assuming the workspace catalog's `zod/v4` export supports Standard JSON Schema.

**Why:** The workspace's Zod 3 compatibility export supports validation but lacks the Standard JSON Schema interface required by the newer SDK. This produced tool-registration type errors.

**How to apply:** Keep the MCP server's schema-library compatibility aligned with the installed SDK. Do not upgrade the whole workspace solely to resolve this server-local requirement.
