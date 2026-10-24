# ABCDE MCP

Independent, nutrition-only MCP server and Latvian/English landing page for ABCDE.lv data. See `docs/abcde-mcp/README.md` for architecture and limitations, and `docs/abcde-mcp/VERIFICATION.md` for checked and pending release behavior.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the MCP/API server with the managed workflow
- `pnpm --filter @workspace/api-server run test` — domain/network tests
- `pnpm --filter @workspace/api-server run test:protocol` — official SDK/live catalogue checks
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM server bundle), Vite (web)
- MCP: official TypeScript SDK v2, Streamable HTTP

## Where things live

- `artifacts/api-server/src/lib/mcp/` — tool registration, catalogue adapter, calculations, metrics, request context
- `artifacts/abcde-mcp/src/App.tsx` — Latvian/English landing page
- `lib/db/src/schema/mcp-metrics.ts` — aggregate tool calls and shared quota buckets
- `lib/api-spec/openapi.yaml` — public stats contract

## Architecture decisions

- Locally recheck upstream search filters; store leakage and ignored Maxima nutrient filters are known upstream limitations.
- Keep search bounded rather than claiming exhaustive catalogue coverage.
- Use the SDK's sessionless HTTP factory; never infer sessions from calls or client fingerprints.

## Product

- Read-only `search_products`, `get_product`, and `build_basket` tools.
- Nutrition-aware shopping lists grouped by retailer, with unknown values and partial totals disclosed.

## User preferences

- Latvian is the default landing-page language, with an English switch.
- Keep ABCDE.lv read-only; do not connect retailer databases.
- Nutrition only: no prices, accounts, carts, checkout, or guaranteed stock.
- Do not publish automatically or display a guessed public MCP URL.

## Gotchas

- Preserve API artifact proxy paths `/api`, `/mcp`, and `/health`.
- Run codegen after changing the OpenAPI contract.
- Configure the actual published URL only after publication; do not use a development URL on the landing page.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
