// Explicit, bounded live integration check; does not run with the offline unit suite.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpProxy } from '../../docs/abcde-mcp/abcde-mcp-proxy.mjs';

const direct = new URL(process.argv[2] ?? 'http://localhost:80/mcp');
const proxy = createMcpProxy({
  upstreamUrl: direct.href, allowedHosts: ['127.0.0.1'],
});
const host = createServer(async (req, res) => {
  if (await proxy(req, res)) return;
  res.writeHead(404); res.end();
});
await new Promise((resolve) => host.listen(0, '127.0.0.1', resolve));
const proxied = new URL(`http://127.0.0.1:${host.address().port}/mcp`);
const expectedTools = ['build_basket', 'get_product', 'search_products'];

async function connect(url, mode) {
  const client = new Client({ name: 'abcde-domain-migration-check', version: '1.0.0' },
    { capabilities: {}, versionNegotiation: { mode } });
  await client.connect(new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { Origin: 'https://abcde.lv' } },
  }));
  return client;
}

function completeText(result) {
  assert.equal(Boolean(result.isError), false, JSON.stringify(result.content));
  const text = result.content.filter((block) => block.type === 'text');
  assert.equal(text.length, 2, 'summary plus complete JSON text');
  assert.deepEqual(JSON.parse(text[1].text), result.structuredContent);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 256 * 1024);
  return result.structuredContent;
}

try {
  for (const mode of ['legacy', 'auto']) {
    for (const [label, url] of [['direct', direct], ['proxy', proxied]]) {
      const client = await connect(url, mode);
      try {
        const { tools } = await client.listTools();
        assert.deepEqual(tools.map((tool) => tool.name).sort(), expectedTools);
        assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint));
        if (label === 'proxy') {
          const detail = completeText(await client.callTool({
            name: 'get_product', arguments: { store: 'rimi', product_id: 3975 },
          }));
          assert.equal(detail.product_id, 3975);
          assert.ok(detail.original_name);
          const search = completeText(await client.callTool({
            name: 'search_products', arguments: { store: 'rimi', query: 'biezpiens', max_results: 1 },
          }));
          assert.ok(search.products.length > 0);
          assert.ok(search.products.every((product) => product.product_id && product.original_name));
          const basket = completeText(await client.callTool({
            name: 'build_basket', arguments: { items: [{ store: 'rimi', product_id: 3975, quantity: 1 }] },
          }));
          assert.equal(basket.groups[0].lines[0].product_id, 3975);
        }
        console.log(`PASS ${label} ${mode}: negotiation, tools${label === 'proxy' ? ', three live tools and complete text/structured results' : ''}`);
      } finally { await client.close(); }
    }
  }
  for (const [label, url] of [['direct', direct], ['proxy', proxied]]) {
    for (const origin of ['https://evil.example', 'null']) {
      const response = await fetch(url, { headers: { Origin: origin, 'X-Forwarded-Host': 'abcde.lv' } });
      assert.equal(response.status, 403, `${label} invalid Origin`);
    }
    const notification = await fetch(url, {
      method: 'POST', headers: {
        'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
        Origin: 'https://abcde.lv', 'Mcp-Protocol-Version': '2025-03-26',
      },
      body: '{"jsonrpc":"2.0","method":"notifications/initialized"}',
    });
    assert.equal(notification.status, 202);
    for (const method of ['GET', 'DELETE']) {
      const response = await fetch(url, {
        method, headers: { Accept: 'application/json, text/event-stream', Origin: 'https://abcde.lv' },
      });
      assert.equal(response.status, 405, `${label} stateless ${method}`);
      assert.ok(!response.headers.get('content-type')?.includes('text/html'));
    }
  }
  console.log('PASS direct and proxy: invalid origins rejected, notifications 202, stateless GET/DELETE 405');
} finally {
  host.closeAllConnections();
  await new Promise((resolve) => host.close(resolve));
}
