import { pool } from "@workspace/db";

const TOOL_LIMIT_PER_MINUTE = 120;
const UPSTREAM_LIMIT_PER_MINUTE = 60;

export interface PublicStats {
  toolCalls: number;
  measuredSessions: number | null;
  sessionMeasurementAvailable: boolean;
}

export interface ToolAttemptResult {
  allowed: boolean;
  reason?: "global_limit" | "storage_unavailable";
}

function minuteStart(now = Date.now()): Date {
  return new Date(Math.floor(now / 60_000) * 60_000);
}

async function cleanupBounded(now: Date): Promise<void> {
  const minuteCutoff = new Date(now.getTime() - 60 * 60 * 1000);

  await pool.query(
    `DELETE FROM mcp_global_rate_limits
     WHERE (bucket, window_start) IN (
       SELECT bucket, window_start FROM mcp_global_rate_limits
       WHERE window_start < $1 LIMIT 100
     )`,
    [minuteCutoff],
  );
}

let cleanupCounter = 0;

export async function recordToolAttempt(): Promise<ToolAttemptResult> {
  const now = new Date();
  const windowStart = minuteStart(now.getTime());
  const client = await pool.connect();
  let result: ToolAttemptResult = { allowed: true };

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO mcp_usage (id, tool_calls, measured_sessions)
       VALUES (1, 1, 0)
       ON CONFLICT (id) DO UPDATE SET tool_calls = mcp_usage.tool_calls + 1`,
    );

    const globalBudget = await client.query(
      `INSERT INTO mcp_global_rate_limits (bucket, window_start, request_count)
       VALUES ('tool', $1, 1)
       ON CONFLICT (bucket, window_start)
       DO UPDATE SET request_count = mcp_global_rate_limits.request_count + 1
       WHERE mcp_global_rate_limits.request_count < $2
       RETURNING request_count`,
      [windowStart, TOOL_LIMIT_PER_MINUTE],
    );

    if (globalBudget.rowCount !== 1) {
      result = { allowed: false, reason: "global_limit" };
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  cleanupCounter += 1;
  if (cleanupCounter >= 100) {
    cleanupCounter = 0;
    void cleanupBounded(now).catch(() => undefined);
  }
  return result;
}

export async function consumeUpstreamBudget(): Promise<void> {
  const windowStart = minuteStart();
  const result = await pool.query(
    `INSERT INTO mcp_global_rate_limits (bucket, window_start, request_count)
     VALUES ('upstream', $1, 1)
     ON CONFLICT (bucket, window_start)
     DO UPDATE SET request_count = mcp_global_rate_limits.request_count + 1
     WHERE mcp_global_rate_limits.request_count < $2
     RETURNING request_count`,
    [windowStart, UPSTREAM_LIMIT_PER_MINUTE],
  );
  if (result.rowCount !== 1) {
    throw new Error("upstream_budget_exhausted");
  }
}

export async function getPublicStats(): Promise<PublicStats> {
  const result = await pool.query<{
    tool_calls: string | number;
    measured_sessions: string | number;
  }>(
    `SELECT tool_calls, measured_sessions FROM mcp_usage WHERE id = 1`,
  );
  const row = result.rows[0];
  return {
    toolCalls: Number(row?.tool_calls ?? 0),
    measuredSessions: null,
    sessionMeasurementAvailable: false,
  };
}

export async function checkMetricsStorage(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
