// Both are owner-approved public addresses. Advertising one must never disable the other.
export const publicMcpHosts = ["abcde.lv", "abcde-mcp.replit.app"] as const;

export function configuredMcpHosts(env: Record<string, string | undefined>): string[] {
  const hosts = new Set<string>(["localhost", "127.0.0.1", "[::1]", ...publicMcpHosts]);
  for (const value of [
    ...(env.REPLIT_DOMAINS ?? "").split(","),
    env.REPLIT_DEV_DOMAIN,
    env.PUBLIC_MCP_URL,
  ]) {
    if (!value?.trim()) continue;
    try {
      const url = new URL(value.includes("://") ? value.trim() : `https://${value.trim()}`);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) continue;
      if (url.hostname) hosts.add(url.hostname);
    } catch { /* Invalid server configuration is not a trusted host. */ }
  }
  // Never derive trusted hosts from any request or forwarded header.
  return [...hosts];
}
