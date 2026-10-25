import assert from "node:assert/strict";
import test from "node:test";
import { configuredMcpHosts } from "./host-policy";
import { validateHostHeader, validateOriginHeader } from "@modelcontextprotocol/server";

test("both public MCP hosts remain trusted independently of the advertised address", () => {
  for (const PUBLIC_MCP_URL of [undefined, "https://abcde.lv/mcp", "https://abcde-mcp.replit.app/mcp"]) {
    const hosts = configuredMcpHosts({ PUBLIC_MCP_URL, REPLIT_DOMAINS: "preview.replit.dev" });
    for (const host of ["abcde.lv", "abcde-mcp.replit.app", "preview.replit.dev", "localhost", "[::1]"]) {
      assert.equal(validateHostHeader(host, hosts).ok, true);
      assert.equal(validateOriginHeader(`https://${host}`, hosts).ok, true);
    }
    for (const host of ["evil.example", "abcde.lv.evil.example", "abcde-mcp.replit.app.evil.example"]) {
      assert.equal(validateHostHeader(host, hosts).ok, false);
      assert.equal(validateOriginHeader(`https://${host}`, hosts).ok, false);
    }
    assert.equal(validateOriginHeader(undefined, hosts).ok, true);
    assert.equal(validateOriginHeader("null", hosts).ok, false);
  }
});

test("invalid configured hosts cannot introduce credentials or unsupported schemes", () => {
  const hosts = configuredMcpHosts({
    PUBLIC_MCP_URL: "https://user:password@evil.example/mcp",
    REPLIT_DOMAINS: "valid.replit.dev,not a host",
    REPLIT_DEV_DOMAIN: "javascript:bad",
  });
  assert.ok(hosts.includes("valid.replit.dev"));
  assert.equal(hosts.includes("evil.example"), false);
  assert.equal(hosts.includes("bad"), false);
});
