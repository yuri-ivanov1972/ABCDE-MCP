import { AsyncLocalStorage } from "node:async_hooks";
import type { ToolAttemptResult } from "./metrics";

export interface McpRequestContext {
  signal: AbortSignal;
  attempts: Map<string, ToolAttemptResult[]>;
}

const requestStorage = new AsyncLocalStorage<McpRequestContext>();

export function withMcpRequestContext<T>(
  context: McpRequestContext,
  action: () => Promise<T>,
): Promise<T> {
  return requestStorage.run(context, action);
}

export function currentMcpRequestSignal(): AbortSignal | undefined {
  return requestStorage.getStore()?.signal;
}

export function takeRecordedToolAttempt(
  toolName: string,
): ToolAttemptResult | undefined {
  const attempts = requestStorage.getStore()?.attempts.get(toolName);
  return attempts?.shift();
}
