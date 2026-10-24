import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { Request, Response } from "express";
import { logger } from "../../lib/logger";
import {
  recordToolAttempt,
  type ToolAttemptResult,
} from "./metrics";
import { withMcpRequestContext } from "./request-context";
import { createMcpServer } from "./server";

const recognizedTools = new Set([
  "search_products",
  "get_product",
  "build_basket",
]);

function hostFromUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function configuredHosts(): string[] {
  const hosts = new Set(["localhost", "127.0.0.1", "::1"]);
  for (const item of (process.env.REPLIT_DOMAINS ?? "").split(",")) {
    const host = item.trim().split(":")[0];
    if (host) hosts.add(host);
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    hosts.add(process.env.REPLIT_DEV_DOMAIN.trim());
  }
  const publicHost = hostFromUrl(process.env.PUBLIC_MCP_URL);
  if (publicHost) hosts.add(publicHost);
  return [...hosts];
}

const hosts = configuredHosts();
const mcpApp = createMcpExpressApp({
  host: "0.0.0.0",
  allowedHosts: hosts,
  allowedOrigins: [...hosts, "claude.ai", "claude.com", "www.claude.com"],
  jsonLimit: "32kb",
});

const handler = toNodeHandler(
  createMcpHandler(() => createMcpServer()),
  {
    maxRequestBodySize: 32 * 1024,
    onerror: () => logger.error({ category: "mcp_adapter" }, "MCP request failed"),
  },
);

function recognizedToolNames(body: unknown): string[] {
  const messages = Array.isArray(body) ? body : [body];
  const names: string[] = [];
  for (const value of messages) {
    if (!value || typeof value !== "object") continue;
    const message = value as Record<string, unknown>;
    if (message.method !== "tools/call") continue;
    const params =
      message.params && typeof message.params === "object"
        ? (message.params as Record<string, unknown>)
        : {};
    if (typeof params.name === "string" && recognizedTools.has(params.name)) {
      names.push(params.name);
    }
  }
  return names;
}

function addAttempt(
  attempts: Map<string, ToolAttemptResult[]>,
  name: string,
  result: ToolAttemptResult,
): void {
  const queue = attempts.get(name) ?? [];
  queue.push(result);
  attempts.set(name, queue);
}

async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const controller = new AbortController();
  const abortIfDisconnected = () => {
    if (!res.writableEnded) {
      controller.abort(new Error("client_disconnected"));
    }
  };
  res.on("close", abortIfDisconnected);

  const attempts = new Map<string, ToolAttemptResult[]>();
  for (const toolName of recognizedToolNames(req.body)) {
    try {
      addAttempt(attempts, toolName, await recordToolAttempt());
    } catch {
      addAttempt(attempts, toolName, {
        allowed: false,
        reason: "storage_unavailable",
      });
    }
  }

  await withMcpRequestContext(
    { signal: controller.signal, attempts },
    async () => handler(req, res, req.body),
  );
}

mcpApp.all("/mcp", (req, res) => {
  void handleMcpRequest(req, res).catch((error: unknown) => {
    logger.error(
      {
        category:
          error instanceof Error && error.name === "AbortError"
            ? "mcp_cancelled"
            : "mcp_handler",
      },
      "MCP request failed",
    );
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "The MCP request could not be completed." },
        id: null,
      });
    }
  });
});

export default mcpApp;
