import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { createMcpProxy } from './abcde-mcp-proxy.mjs';

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function fixture(handler, options = {}) {
  const upstream = createServer(handler);
  const address = await listen(upstream);
  const proxy = createMcpProxy({
    upstreamUrl: `${address}/mcp`, allowedHosts: ['127.0.0.1'], ...options,
  });
  const host = createServer(async (req, res) => {
    if (await proxy(req, res)) return;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('Existing website');
  });
  const origin = await listen(host);
  return { origin, close: async () => {
    for (const server of [host, upstream]) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  } };
}

const post = (origin, body = '{}', headers = {}) => fetch(`${origin}/mcp`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body,
});

test('exact route only, raw body and modern/legacy protocol headers; no credentials or target override', async () => {
  let captured;
  const f = await fixture(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    captured = { headers: req.headers, body: Buffer.concat(chunks).toString(), url: req.url };
    res.writeHead(200, {
      'Content-Type': 'application/json', 'Mcp-Protocol-Version': '2025-11-25',
      'Mcp-Session-Id': 'fixture-session', 'Set-Cookie': 'private=do-not-copy',
      'Cache-Control': 'public, max-age=9999', 'X-Secret-Header': 'do-not-copy',
    });
    res.end('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}');
  });
  try {
    const body = '{ "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {"label":"ā"} }\n';
    const response = await fetch(`${f.origin}/mcp?url=https://evil.example`, {
      method: 'POST', body, headers: {
        'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
        Origin: 'https://abcde.lv', 'Mcp-Protocol-Version': '2025-11-25',
        'Mcp-Method': 'tools/list', 'Mcp-Name': 'get_product',
        'Mcp-Session-Id': 'fixture-session', 'Last-Event-Id': 'event-42',
        Cookie: 'main-site=private', Authorization: 'Bearer fixture-only',
        'X-Forwarded-Host': 'evil.example', 'X-Forwarded-For': 'private-address',
      },
    });
    assert.equal(response.status, 200);
    assert.ok((await response.json()).result.ok);
    assert.equal(captured.body, body);
    assert.equal(captured.url, '/mcp');
    for (const header of ['mcp-protocol-version', 'mcp-method', 'mcp-name', 'mcp-session-id', 'last-event-id', 'origin']) {
      assert.ok(captured.headers[header], header);
    }
    for (const header of ['cookie', 'authorization', 'x-forwarded-for', 'x-forwarded-host']) {
      assert.equal(captured.headers[header], undefined, header);
    }
    assert.equal(response.headers.get('mcp-session-id'), 'fixture-session');
    assert.equal(response.headers.get('mcp-protocol-version'), '2025-11-25');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('x-secret-header'), null);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://abcde.lv');
    for (const route of ['/', '/lv/mcp', '/en/mcp', '/mcp/', '/mcp/other', '/mcp-site/stats', '/api/stats']) {
      assert.equal(await (await fetch(`${f.origin}${route}`)).text(), 'Existing website', route);
    }
  } finally { await f.close(); }
});

test('Host/Origin checks reject forgery before contacting upstream; valid preflight is bounded', async () => {
  let calls = 0;
  const f = await fixture((_req, res) => { calls++; res.end(); });
  try {
    for (const headers of [
      { Origin: 'https://evil.example', 'X-Forwarded-Host': 'abcde.lv' },
      { Origin: 'null' }, { Origin: 'https://abcde.lv.evil.example' },
      { Host: 'evil.example', 'X-Forwarded-Host': 'abcde.lv' },
    ]) {
      // Native request preserves an explicit Host; fetch may replace it.
      const status = await new Promise((resolve, reject) => {
        const req = request(`${f.origin}/mcp`, { method: 'POST', headers },
          (res) => { res.resume(); resolve(res.statusCode); });
        req.on('error', reject);
        req.end('{}');
      });
      assert.equal(status, 403, JSON.stringify(headers));
    }
    const preflight = await fetch(`${f.origin}/mcp`, { method: 'OPTIONS', headers: { Origin: 'https://claude.ai' } });
    assert.equal(preflight.status, 204);
    assert.ok(preflight.headers.get('access-control-allow-headers').includes('mcp-method'));
    assert.equal((await fetch(`${f.origin}/mcp`, { method: 'PUT' })).status, 405);
    assert.equal(calls, 0);
  } finally { await f.close(); }
});

test('oversized, chunked oversized and compressed input fail before upstream', async () => {
  let calls = 0;
  const f = await fixture((_req, res) => { calls++; res.end(); });
  try {
    assert.equal((await post(f.origin, 'x'.repeat(32769))).status, 413);
    assert.equal((await post(f.origin, '{}', { 'Content-Encoding': 'gzip' })).status, 415);
    const status = await new Promise((resolve, reject) => {
      const req = request(`${f.origin}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        (res) => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject);
      req.write('x'.repeat(20000));
      req.end('y'.repeat(20000));
    });
    assert.equal(status, 413);
    assert.equal(calls, 0);
  } finally { await f.close(); }
});

test('SSE first chunk arrives before upstream finishes, and cancellation closes upstream', async () => {
  let endUpstream, closed;
  const closedPromise = new Promise((resolve) => { closed = resolve; });
  const f = await fixture((_req, res) => {
    res.on('close', closed);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('event: message\ndata: {"first":true}\n\n');
    endUpstream = () => res.end('data: {"last":true}\n\n');
  });
  try {
    const abort = new AbortController();
    const response = await fetch(`${f.origin}/mcp`, { signal: abort.signal });
    const reader = response.body.getReader();
    const first = await reader.read();
    assert.ok(new TextDecoder().decode(first.value).includes('"first":true'));
    // Upstream has deliberately not ended. Buffered page-proxy code would hang here.
    abort.abort();
    await assert.rejects(reader.read());
    await Promise.race([closedPromise, new Promise((_, reject) => setTimeout(() => reject(Error('Upstream not cancelled')), 1500))]);
    endUpstream();
  } finally { await f.close(); }
});

test('notification, unsupported methods, errors and protocol headers retain upstream statuses', async () => {
  const f = await fixture((req, res) => {
    const status = req.method === 'POST' ? 202 : req.method === 'DELETE' ? 405 : 400;
    res.writeHead(status, { 'Content-Type': 'application/json', Allow: 'POST',
      'Retry-After': '2', 'Mcp-Protocol-Version': '2025-11-25' });
    res.end(status === 202 ? undefined : '{"error":"SDK failure"}');
  });
  try {
    assert.equal((await post(f.origin)).status, 202);
    for (const [method, status] of [['DELETE', 405], ['GET', 400], ['HEAD', 400]]) {
      const response = await fetch(`${f.origin}/mcp`, { method });
      assert.equal(response.status, status);
      assert.equal(response.headers.get('retry-after'), '2');
      assert.equal(response.headers.get('allow'), 'POST');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      if (method === 'HEAD') assert.equal(await response.text(), '');
    }
  } finally { await f.close(); }
});

test('redirects and successful HTML fallback are rejected, never followed', async () => {
  for (const status of [200, 307]) {
    const f = await fixture((_req, res) => {
      res.writeHead(status, { 'Content-Type': 'text/html', Location: 'https://evil.example' });
      res.end('<html>Not MCP</html>');
    });
    try {
      const response = await post(f.origin);
      assert.equal(response.status, 502);
      assert.equal(response.headers.get('location'), null);
    } finally { await f.close(); }
  }
});

test('stalled headers, stalled stream and oversized response are bounded failures', async () => {
  const silent = await fixture(() => {}, { timeoutMs: 60 });
  try { assert.equal((await post(silent.origin)).status, 504); }
  finally { await silent.close(); }
  for (const oversized of [true, false]) {
    const f = await fixture((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.flushHeaders();
      if (oversized) res.end('x'.repeat(100));
    }, { timeoutMs: 100, maxResponseBytes: 50 });
    try {
      await assert.rejects(async () => {
        const response = await fetch(`${f.origin}/mcp`);
        await response.text();
      });
    } finally { await f.close(); }
  }
});

test('mounting after a body parser fails explicitly rather than forwarding empty input', async () => {
  const proxy = createMcpProxy({ allowedHosts: ['127.0.0.1'] });
  const host = createServer((req, res) => { req.body = {}; return proxy(req, res); });
  const origin = await listen(host);
  try {
    const response = await post(origin);
    assert.equal(response.status, 500);
    assert.match(await response.text(), /before body parsers/);
  } finally { host.closeAllConnections(); await new Promise((resolve) => host.close(resolve)); }
});

test('fixed upstream configuration rejects paths, queries, credentials and nonlocal HTTP', () => {
  for (const url of ['https://evil.example/', 'https://user:pass@abcde-mcp.replit.app/mcp',
    'https://abcde-mcp.replit.app/mcp?url=x', 'http://abcde-mcp.replit.app/mcp']) {
    assert.throws(() => createMcpProxy({ upstreamUrl: url }));
  }
});
