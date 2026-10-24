---
name: MCP client text compatibility
description: Why complete tool data must remain accessible without structuredContent
---

Treat text-only MCP consumers as a supported compatibility requirement, not merely clients that fail output-schema validation.

**Why:** The owner's real Claude connector could read search-summary sentences but not the product data. An official-client check of the published endpoint found complete products only in structuredContent. Earlier protocol checks passed because they inspected only that structured field.

**How to apply:** Preserve a complete parseable text representation alongside structured results for every successful tool. Validate text-only consumption as well as schema-valid structured data, and account for duplication and JSON escaping when bounding serialized responses. SDK success alone does not establish real Claude usability.
