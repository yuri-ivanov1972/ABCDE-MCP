---
name: Landing page branding
description: Owner's requirement to align MCP landing page branding with the separate abcde.lv website
---

Use the logo, favicon, styles and colors from abcde.lv for the MCP landing page.

**Why:** The owner explicitly requested that the MCP landing page use the main website's branding.

**How to apply:** Inspect the current main-site branding and reuse verified assets rather than creating a separate MCP visual identity. This requirement concerns the landing page, not the slide deck or server functionality.

Keep brand assets local and ensure their URLs are identical during initial HTML rendering and hydration.

**Why:** Human pages run both standalone and behind a narrow main-site proxy. Prerendering uses Vite's middleware module loader, whose imported image URLs can differ from the client build's hashed image URLs. An ordinary image import is therefore not automatically safe here.

**How to apply:** Use a content-fingerprinted scoped public asset URL, or explicitly resolve build asset mappings for both rendering paths. Check the built page through the proxy, not just Vite, whenever introducing assets.
