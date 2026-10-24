# ABCDE MCP

A public, read-only MCP server for ABCDE.lv food nutrition data, with a Latvian-first/English landing page. It provides `search_products`, `get_product`, and `build_basket` for Claude.

**Nutrition only:** no prices, checkout, accounts, or guaranteed live stock. Rimi and Maxima products link to their retailer sites (Maxima links may lead to Barbora).

## Development

```sh
pnpm install
pnpm --filter @workspace/db run push
pnpm run typecheck
pnpm --filter @workspace/api-server run test
```

Run the configured API and landing-page workflows in Replit. MCP is served at `/mcp`; aggregate counters at `/api/stats`; health at `/health`.

After starting the services, run the official SDK protocol check:

```sh
pnpm --filter @workspace/api-server run test:protocol
```

It defaults to the local proxy for development. Pass the actual public HTTPS `/mcp` URL to check a published release. This does not publish the project.

See [the complete setup, architecture, privacy, field mapping, limitations, and Claude instructions](docs/abcde-mcp/README.md).
See also [the verification record and remaining release checks](docs/abcde-mcp/VERIFICATION.md).

The public connector URL is intentionally unset until publication. A real Claude-account connection must be verified separately after publication.
