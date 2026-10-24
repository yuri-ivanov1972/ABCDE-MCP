import {
  bigint,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const mcpUsageTable = pgTable("mcp_usage", {
  id: integer("id").primaryKey(),
  toolCalls: bigint("tool_calls", { mode: "number" }).notNull().default(0),
  measuredSessions: bigint("measured_sessions", { mode: "number" })
    .notNull()
    .default(0),
});

export const mcpGlobalRateLimitsTable = pgTable(
  "mcp_global_rate_limits",
  {
    bucket: text("bucket").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.bucket, table.windowStart] })],
);
